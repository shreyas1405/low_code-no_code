"""Seed script: generates 25 synthetic insurance claims across all workflow paths."""
import json
import random
import urllib.request

API = "http://127.0.0.1:8000/api"
random.seed(42)

CLAIM_DATA = [
    # --- 8 claims that will be Approved (Closed - Paid) ---
    # These are low-risk types (water_damage, windstorm) or low-amount high-risk types
    {"claim_type": "water_damage",  "description": "Water pipe burst in basement, flooding ground floor", "amount": 12000,  "insured_name": "Jane Doe",       "insured_email": "jane@example.com",  "incident_date": "2026-10-15", "policy_number": "POL-WAT-001", "priority": "normal"},
    {"claim_type": "windstorm",     "description": "Tree fell on garage during storm", "amount": 8500,   "insured_name": "Bob Wilson",       "insured_email": "bob@example.com",   "incident_date": "2026-10-18", "policy_number": "POL-WIN-002", "priority": "normal"},
    {"claim_type": "water_damage",  "description": "Roof leak during heavy rain, ceiling damage", "amount": 5500,   "insured_name": "Alice Chen",       "insured_email": "alice@example.com", "incident_date": "2026-10-12", "policy_number": "POL-WAT-003", "priority": "low"},
    {"claim_type": "windstorm",     "description": "Windows broken by flying debris", "amount": 3200,   "insured_name": "Carlos Ruiz",      "insured_email": "carlos@example.com", "incident_date": "2026-10-20", "policy_number": "POL-WIN-004", "priority": "normal"},
    {"claim_type": "water_damage",  "description": "Washing machine hose ruptured, kitchen flood", "amount": 7800,   "insured_name": "Diana Park",       "insured_email": "diana@example.com",  "incident_date": "2026-10-10", "policy_number": "POL-WAT-005", "priority": "normal"},
    {"claim_type": "fire",          "description": "Small electrical fire, contained quickly", "amount": 25000,  "insured_name": "Edward King",      "insured_email": "edward@example.com", "incident_date": "2026-10-14", "policy_number": "POL-FIR-006", "priority": "high"},
    {"claim_type": "windstorm",     "description": "Fence damaged by wind gusts", "amount": 1800,   "insured_name": "Fiona Green",      "insured_email": "fiona@example.com",   "incident_date": "2026-10-22", "policy_number": "POL-WIN-007", "priority": "low"},
    {"claim_type": "water_damage",  "description": "Toilet overflow caused bathroom floor damage", "amount": 4200,   "insured_name": "George Brown",     "insured_email": "george@example.com", "incident_date": "2026-10-16", "policy_number": "POL-WAT-008", "priority": "normal"},

    # --- 4 claims auto-rejected as Fraud (high-risk type + amount > 50000) ---
    {"claim_type": "fire",          "description": "Large house fire, total loss suspected", "amount": 120000, "insured_name": "Henry Ford",       "insured_email": "henry@example.com",  "incident_date": "2026-10-23", "policy_number": "POL-FIR-009", "priority": "urgent"},
    {"claim_type": "flood",         "description": "Severe basement flooding from river overflow", "amount": 85000, "insured_name": "Iris Adams",       "insured_email": "iris@example.com",   "incident_date": "2026-10-21", "policy_number": "POL-FLO-010", "priority": "urgent"},
    {"claim_type": "theft",         "description": "Expensive jewelry stolen, high value claim", "amount": 65000, "insured_name": "Jack London",      "insured_email": "jack@example.com",   "incident_date": "2026-10-19", "policy_number": "POL-THE-011", "priority": "high"},
    {"claim_type": "accident",      "description": "Luxury car accident, repair costs high", "amount": 95000, "insured_name": "Karen Scott",      "insured_email": "karen@example.com",  "incident_date": "2026-10-17", "policy_number": "POL-ACC-012", "priority": "high"},

    # --- 3 claims human-rejected (Not Approved) ---
    # (will create + approve some, reject some)
    {"claim_type": "water_damage",  "description": "Minor leak, claim seems excessive", "amount": 3500,  "insured_name": "Liam Neeson",      "insured_email": "liam@example.com",   "incident_date": "2026-10-05", "policy_number": "POL-WAT-013", "priority": "normal"},
    {"claim_type": "windstorm",     "description": "Slight siding damage, overestimated cost", "amount": 4200,  "insured_name": "Mary Johnson",     "insured_email": "mary@example.com",    "incident_date": "2026-10-08", "policy_number": "POL-WIN-014", "priority": "low"},
    {"claim_type": "water_damage",  "description": "Previous claim history on same incident", "amount": 6200, "insured_name": "Nick Fury",        "insured_email": "nick@example.com",    "incident_date": "2026-10-11", "policy_number": "POL-WAT-015", "priority": "normal"},

    # --- 3 claims auto-rejected (Incomplete - missing required fields) ---
    {"claim_type": "accident",      "description": "", "amount": 0,     "insured_name": "",       "insured_email": "", "incident_date": "2026-10-23", "policy_number": "", "priority": "low"},
    {"claim_type": "",              "description": "Damage", "amount": 5000,  "insured_name": "",     "insured_email": "", "incident_date": "2026-10-23", "policy_number": "", "priority": "low"},
    {"claim_type": "theft",         "description": "", "amount": 0,     "insured_name": "", "insured_email": "", "incident_date": "2026-10-23", "policy_number": "", "priority": "low"},

    # --- 7 claims pending human review (tasks left in queue) ---
    {"claim_type": "water_damage",  "description": "Kitchen cabinet water damage from dishwasher", "amount": 4800,  "insured_name": "Olivia Brown",     "insured_email": "olivia@example.com", "incident_date": "2026-10-28", "policy_number": "POL-WAT-019", "priority": "normal"},
    {"claim_type": "windstorm",     "description": "Gutter damage from recent storm", "amount": 1500,  "insured_name": "Peter Parker",     "insured_email": "peter@example.com",  "incident_date": "2026-10-28", "policy_number": "POL-WIN-020", "priority": "low"},
    {"claim_type": "fire",          "description": "Small fireplace ember caused minor damage", "amount": 3800,  "insured_name": "Quinn Foster",     "insured_email": "quinn@example.com",  "incident_date": "2026-10-27", "policy_number": "POL-FIR-021", "priority": "normal"},
    {"claim_type": "water_damage",  "description": "Shower grout leak, bathroom floor", "amount": 2200,  "insured_name": "Rachel Green",     "insured_email": "rachel@example.com", "incident_date": "2026-10-27", "policy_number": "POL-WAT-022", "priority": "low"},
    {"claim_type": "windstorm",     "description": "Skylight cracked by falling branch", "amount": 5500,  "insured_name": "Sam Wilson",       "insured_email": "sam@example.com",    "incident_date": "2026-10-26", "policy_number": "POL-WIN-023", "priority": "normal"},
    {"claim_type": "water_damage",  "description": "Hot water heater leak in closet", "amount": 3100,  "insured_name": "Tina Turner",      "insured_email": "tina@example.com",   "incident_date": "2026-10-26", "policy_number": "POL-WAT-024", "priority": "low"},
    {"claim_type": "accident",      "description": "Minor collision, bumper replacement needed", "amount": 1800,  "insured_name": "Victor Hugo",      "insured_email": "victor@example.com", "incident_date": "2026-10-25", "policy_number": "POL-ACC-025", "priority": "low"},
]


def api(path, method="GET", body=None):
    url = API + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": str(e), "detail": e.read().decode()}


def main():
    created = []
    for i, claim_data in enumerate(CLAIM_DATA, 1):
        result = api("/claims", method="POST", body=claim_data)
        if "claim" in result:
            created.append({
                "index": i,
                "claim_number": result["claim"]["claim_number"],
                "claim_id": result["claim"]["id"],
                "type": claim_data["claim_type"],
                "amount": claim_data["amount"],
                "status": result["claim"]["status"],
                "workflow_status": result.get("workflow_status", ""),
                "current_node": result.get("current_node", ""),
                "went_to_review": result.get("current_node") == "review",
            })
            print(f"  [{i:2d}/25] {result['claim']['claim_number']} | {claim_data['claim_type']:12s} | ${claim_data['amount']:>7,} | {result['claim']['status']}")
        else:
            print(f"  [{i:2d}/25] ERROR: {result}")

    print(f"\nCreated {len(created)} claims.")

    # Process pending tasks: approve claims 1-5, reject claims 16-17
    tasks = api("/tasks")
    if not isinstance(tasks, list):
        tasks = [tasks]
    print(f"\nPending tasks: {len(tasks)}")

    approved = 0
    rejected = 0
    for task in tasks:
        # Find which claim this task belongs to
        claim = next((c for c in created if c["claim_id"] == task["claim_id"]), None)
        if not claim:
            continue

        # Approve the first 5 pending-review claims (indices 1-5)
        if claim["index"] <= 5:
            api(f"/tasks/{task['id']}/action", method="POST", body={"action": "approve", "user": "claims.analyst"})
            approved += 1
        # Reject claims 16-17 (the duplicate water_damage/windstorm claims)
        elif claim["index"] in [16, 17]:
            api(f"/tasks/{task['id']}/action", method="POST", body={"action": "reject", "user": "claims.analyst"})
            rejected += 1

    print(f"Tasks approved: {approved}, rejected: {rejected}")
    print(f"Tasks still pending: {len(tasks) - approved - rejected}")

    # Final dashboard stats
    stats = api("/dashboard/stats")
    print(f"\n=== Final Dashboard ===")
    print(f"Total claims:       {stats['total_claims']}")
    print(f"Active workflows:   {stats['active_workflows']}")
    print(f"Completed workflows: {stats['completed_workflows']}")
    print(f"Pending tasks:      {stats['pending_tasks']}")
    print(f"\nClaims by status:")
    for status, count in sorted(stats['claims_by_status'].items(), key=lambda x: -x[1]):
        print(f"  {status:30s} {count}")


if __name__ == "__main__":
    main()
