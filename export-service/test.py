import sys
sys.path.append('.')
from app.logic import delete_cached_project
print("Delete test1:", delete_cached_project("test1"))
