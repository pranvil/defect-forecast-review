#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
DEFAULT_BRANCH="main"
DEFAULT_REMOTE="origin"

usage() {
  cat <<'EOF'
Usage:
  ./git-sync-mac.sh status
  ./git-sync-mac.sh pull
  ./git-sync-mac.sh push "commit message"
  ./git-sync-mac.sh sync "commit message"

Commands:
  status   Show current branch, remotes, and working tree status.
  pull     Pull the latest code from origin/main.
  push     Stage all changes, commit, and push to origin/main.
  sync     Pull first, then stage, commit, and push.

Examples:
  ./git-sync-mac.sh pull
  ./git-sync-mac.sh push "update forecast UI"
  ./git-sync-mac.sh sync "sync work from MacBook"
EOF
}

ensure_git_repo() {
  if ! git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Error: $REPO_DIR is not a Git repository."
    exit 1
  fi
}

show_status() {
  echo "Repository: $REPO_DIR"
  echo "Branch: $(git -C "$REPO_DIR" branch --show-current)"
  echo
  echo "Remote:"
  git -C "$REPO_DIR" remote -v
  echo
  echo "Status:"
  git -C "$REPO_DIR" status --short
}

pull_latest() {
  echo "Pulling latest code from ${DEFAULT_REMOTE}/${DEFAULT_BRANCH}..."
  git -C "$REPO_DIR" pull "$DEFAULT_REMOTE" "$DEFAULT_BRANCH"
}

require_commit_message() {
  if [ "${1:-}" = "" ]; then
    echo "Error: commit message is required."
    echo
    usage
    exit 1
  fi
}

commit_and_push() {
  local commit_message="$1"

  if [ -z "$(git -C "$REPO_DIR" status --porcelain)" ]; then
    echo "No local changes to commit."
    exit 0
  fi

  echo "Staging changes..."
  git -C "$REPO_DIR" add .

  echo "Creating commit..."
  git -C "$REPO_DIR" commit -m "$commit_message"

  echo "Pushing to ${DEFAULT_REMOTE}/${DEFAULT_BRANCH}..."
  git -C "$REPO_DIR" push "$DEFAULT_REMOTE" "$DEFAULT_BRANCH"
}

main() {
  ensure_git_repo

  case "${1:-}" in
    status)
      show_status
      ;;
    pull)
      pull_latest
      ;;
    push)
      require_commit_message "${2:-}"
      commit_and_push "${2:-}"
      ;;
    sync)
      require_commit_message "${2:-}"
      pull_latest
      commit_and_push "${2:-}"
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      echo "Unknown command: $1"
      echo
      usage
      exit 1
      ;;
  esac
}

main "$@"
