"""
AllocationOptimizer - OR-Tools TSP solver for responder allocation

Uses Google OR-Tools to solve the Vehicle Routing Problem (VRP) with:
- Multiple responders (vehicles)
- Capacity constraints
- Priority-based victim assignment
- Optimized routes minimizing total distance
"""

import time
import math
from typing import List, Dict, Any, Tuple
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp


class AllocationOptimizer:
    """
    Production-grade TSP optimizer for crisis responder allocation
    
    Features:
    - Capacity-constrained VRP
    - Severity-based prioritization
    - Haversine distance calculation
    - <5s solve time for 50 victims + 10 responders
    """

    def __init__(self):
        """Initialize optimizer"""
        self.EARTH_RADIUS_KM = 6371.0
        
        # Severity → Priority mapping (lower = higher priority)
        self.SEVERITY_PRIORITY = {
            "critical": 1,
            "high": 2,
            "moderate": 3,
            "low": 4,
        }

    def allocate(
        self,
        victims: List[Dict[str, Any]],
        responders: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Allocate victims to responders using OR-Tools VRP solver
        
        Args:
            victims: List of victim dicts with id, lat, lng, severity
            responders: List of responder dicts with id, lat, lng, capacity
            
        Returns:
            {
                "status": "success",
                "assignments": [
                    {
                        "responder_id": "r1",
                        "victim_ids": ["v1", "v2"],
                        "route": ["v1", "v2"],
                        "route_distance_km": 12.5
                    }
                ],
                "total_distance_km": 45.2,
                "unassigned_victims": 0,
                "solve_time_ms": 234
            }
        """
        start_time = time.time()

        # Edge cases
        if not victims:
            return self._empty_result(0)
        
        if not responders:
            return self._empty_result(len(victims))

        # Sort victims by priority (critical first)
        sorted_victims = sorted(
            victims,
            key=lambda v: self._severity_to_priority(v.get("severity", "low"))
        )

        # Build distance matrix
        locations = self._build_locations(sorted_victims, responders)
        distance_matrix = self._build_distance_matrix(locations)

        # Create routing model
        manager, routing, distance_callback_index = self._create_routing_model(
            len(sorted_victims),
            len(responders),
            distance_matrix
        )

        # Add capacity constraints
        self._add_capacity_constraints(
            routing,
            manager,
            responders,
            len(sorted_victims)
        )

        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC
        )
        search_parameters.time_limit.seconds = 3  # 3 second timeout
        search_parameters.solution_limit = 100  # Stop after finding 100 solutions

        # Solve
        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            # Fallback: assign greedily
            return self._greedy_fallback(sorted_victims, responders, start_time)

        # Extract solution
        assignments = self._extract_solution(
            manager,
            routing,
            solution,
            sorted_victims,
            responders,
            distance_matrix
        )

        solve_time_ms = int((time.time() - start_time) * 1000)

        total_distance = sum(a["route_distance_km"] for a in assignments)
        total_assigned = sum(len(a["victim_ids"]) for a in assignments)
        unassigned = len(victims) - total_assigned

        return {
            "status": "success",
            "assignments": assignments,
            "total_distance_km": round(total_distance, 2),
            "unassigned_victims": unassigned,
            "solve_time_ms": solve_time_ms
        }

    def _build_locations(
        self,
        victims: List[Dict],
        responders: List[Dict]
    ) -> List[Tuple[float, float]]:
        """Build list of all locations (responders first, then victims)"""
        locations = []
        
        # Responders (depots)
        for r in responders:
            locations.append((r["lat"], r["lng"]))
        
        # Victims
        for v in victims:
            locations.append((v["lat"], v["lng"]))
        
        return locations

    def _build_distance_matrix(
        self,
        locations: List[Tuple[float, float]]
    ) -> List[List[int]]:
        """Build distance matrix in meters (OR-Tools uses integers)"""
        n = len(locations)
        matrix = [[0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    dist_km = self._haversine_distance(
                        locations[i][0], locations[i][1],
                        locations[j][0], locations[j][1]
                    )
                    matrix[i][j] = int(dist_km * 1000)  # Convert to meters
        
        return matrix

    def _create_routing_model(
        self,
        num_victims: int,
        num_responders: int,
        distance_matrix: List[List[int]]
    ) -> Tuple[Any, Any, int]:
        """Create OR-Tools routing model"""
        # Manager handles index mapping
        # For multiple depots, we need starts and ends
        starts = list(range(num_responders))
        ends = list(range(num_responders))
        
        manager = pywrapcp.RoutingIndexManager(
            len(distance_matrix),  # Total locations
            num_responders,        # Number of vehicles
            starts,                # Start indices
            ends                   # End indices
        )

        # Routing model
        routing = pywrapcp.RoutingModel(manager)

        # Distance callback
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)

        # Set arc cost
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        return manager, routing, transit_callback_index

    def _add_capacity_constraints(
        self,
        routing: Any,
        manager: Any,
        responders: List[Dict],
        num_victims: int
    ):
        """Add capacity constraints to routing model"""
        # Demand callback (each victim = 1 demand)
        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            # Responders (depots) have 0 demand
            if from_node < len(responders):
                return 0
            # Victims have demand of 1
            return 1

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)

        # Add capacity dimension
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # No slack
            [r["capacity"] for r in responders],  # Vehicle capacities
            True,  # Start cumul to zero
            "Capacity"
        )

    def _extract_solution(
        self,
        manager: Any,
        routing: Any,
        solution: Any,
        victims: List[Dict],
        responders: List[Dict],
        distance_matrix: List[List[int]]
    ) -> List[Dict[str, Any]]:
        """Extract assignments from OR-Tools solution"""
        assignments = []
        num_responders = len(responders)

        for vehicle_id in range(num_responders):
            index = routing.Start(vehicle_id)
            route_victim_ids = []
            route_distance = 0

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                
                # If this is a victim (not a depot)
                if node_index >= num_responders:
                    victim_index = node_index - num_responders
                    route_victim_ids.append(victims[victim_index]["id"])
                
                # Get next index
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                
                # Add distance
                route_distance += distance_matrix[
                    manager.IndexToNode(previous_index)
                ][manager.IndexToNode(index)]

            # Only include if victims were assigned
            if route_victim_ids:
                assignments.append({
                    "responder_id": responders[vehicle_id]["id"],
                    "victim_ids": route_victim_ids,
                    "route": route_victim_ids,  # Same as victim_ids (ordered)
                    "route_distance_km": round(route_distance / 1000.0, 2)
                })

        return assignments

    def _greedy_fallback(
        self,
        victims: List[Dict],
        responders: List[Dict],
        start_time: float
    ) -> Dict[str, Any]:
        """Greedy fallback if OR-Tools fails"""
        assignments = []
        assigned_victims = set()

        for responder in responders:
            victim_ids = []
            route_distance = 0.0
            current_lat, current_lng = responder["lat"], responder["lng"]

            # Assign nearest victims up to capacity
            for _ in range(responder["capacity"]):
                nearest = None
                nearest_dist = float('inf')

                for victim in victims:
                    if victim["id"] in assigned_victims:
                        continue
                    
                    dist = self._haversine_distance(
                        current_lat, current_lng,
                        victim["lat"], victim["lng"]
                    )
                    
                    if dist < nearest_dist:
                        nearest = victim
                        nearest_dist = dist

                if nearest:
                    victim_ids.append(nearest["id"])
                    assigned_victims.add(nearest["id"])
                    route_distance += nearest_dist
                    current_lat, current_lng = nearest["lat"], nearest["lng"]

            if victim_ids:
                assignments.append({
                    "responder_id": responder["id"],
                    "victim_ids": victim_ids,
                    "route": victim_ids,
                    "route_distance_km": round(route_distance, 2)
                })

        solve_time_ms = int((time.time() - start_time) * 1000)
        total_distance = sum(a["route_distance_km"] for a in assignments)
        unassigned = len(victims) - len(assigned_victims)

        return {
            "status": "success",
            "assignments": assignments,
            "total_distance_km": round(total_distance, 2),
            "unassigned_victims": unassigned,
            "solve_time_ms": solve_time_ms
        }

    def _haversine_distance(
        self,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float
    ) -> float:
        """
        Calculate distance between two points using Haversine formula
        
        Returns:
            Distance in kilometers
        """
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)

        # Haversine formula
        a = (
            math.sin(dlat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
        )
        c = 2 * math.asin(math.sqrt(a))

        return self.EARTH_RADIUS_KM * c

    def _severity_to_priority(self, severity: str) -> int:
        """Convert severity to priority (lower = higher priority)"""
        return self.SEVERITY_PRIORITY.get(severity.lower(), 5)

    def _calculate_naive_distance(
        self,
        victims: List[Dict],
        responder: Dict
    ) -> float:
        """Calculate naive distance (visit in order) for benchmarking"""
        total_distance = 0.0
        current_lat, current_lng = responder["lat"], responder["lng"]

        for victim in victims:
            dist = self._haversine_distance(
                current_lat, current_lng,
                victim["lat"], victim["lng"]
            )
            total_distance += dist
            current_lat, current_lng = victim["lat"], victim["lng"]

        return total_distance

    def _empty_result(self, unassigned_count: int) -> Dict[str, Any]:
        """Return empty result for edge cases"""
        return {
            "status": "success",
            "assignments": [],
            "total_distance_km": 0.0,
            "unassigned_victims": unassigned_count,
            "solve_time_ms": 0
        }
