import urllib.request
import json

BASE = "http://127.0.0.1:8000"

def get(path):
    data = urllib.request.urlopen(BASE + path).read()
    return json.loads(data)

print("=" * 50)
print("TNEC-KTKH API VERIFICATION")
print("=" * 50)

users = get("/api/users")
print(f"\n👤 Users: {len(users)} records")
for u in users:
    print(f"   {u['full_name']} | {u['role']} | {u['id'][:8]}... | {u['email']}")

projects = get("/api/projects")
print(f"\n📁 Projects: {len(projects)} records")
for p in projects:
    print(f"   {p['name']} | Budget: {p['total_budget_vnd']} | Status: {p['status']}")

tasks = get("/api/tasks")
print(f"\n📋 Tasks: {len(tasks)} records")
for t in tasks:
    print(f"   {t['title'][:45]} | {t['status']} | VND: {t['value_vnd']}")

# Test task detail with relations
if tasks:
    tid = tasks[0]["id"]
    detail = get(f"/api/tasks/{tid}")
    print(f"\n📄 Task Detail (ID: {tid[:8]}...):")
    print(f"   Title: {detail['title']}")
    print(f"   Attachments: {len(detail.get('attachments', []))}")
    print(f"   Activity Logs: {len(detail.get('activity_logs', []))}")
    if detail.get("assignee"):
        print(f"   Assignee: {detail['assignee']['full_name']}")

print("\n" + "=" * 50)
print("✅ ALL API ENDPOINTS WORKING!")
print("=" * 50)
