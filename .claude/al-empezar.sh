#!/usr/bin/env bash
# Se corre solo al abrir una sesión de Claude Code (hook SessionStart).
#
# Trae lo último del repo antes de trabajar. NO hace merges ni rebases: sólo
# avanza si la rama puede adelantarse sola y el árbol está limpio. Si hay
# cambios sin commitear, lo dice y no toca nada — ponerse al día no puede costar
# trabajo que no esté en ningún otro lado.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="$HOME/vault"

# Si las claves tienen passphrase, sin el socket del agente un `fetch` por SSH se
# cuelga pidiéndola y el hook se come su timeout.
export SSH_AUTH_SOCK="${SSH_AUTH_SOCK:-$(gpgconf --list-dirs agent-ssh-socket 2>/dev/null || true)}"

poner_al_dia() {
  local dir="$1" nombre="$2"
  [ -d "$dir/.git" ] || return
  local rama; rama="$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  if ! timeout 25 git -C "$dir" fetch --quiet origin 2>/dev/null; then
    echo "· $nombre ($rama): no se pudo consultar el remoto — puede faltar el ssh-agent."
    return
  fi
  local detras sucio
  detras="$(git -C "$dir" rev-list --count HEAD..@{u} 2>/dev/null || echo 0)"
  sucio="$(git -C "$dir" status --porcelain | wc -l)"
  if [ "$detras" = "0" ]; then
    echo "· $nombre ($rama): al día$([ "$sucio" -gt 0 ] && echo " · $sucio sin commitear")"
  elif [ "$sucio" -gt 0 ]; then
    echo "· $nombre ($rama): $detras commit(s) por traer, PERO hay $sucio fichero(s) sin commitear."
    echo "    No se hizo pull. Mirá el diff y decidí vos."
  elif git -C "$dir" merge --ff-only --quiet @{u} 2>/dev/null; then
    echo "· $nombre ($rama): traídos $detras commit(s)."
    git -C "$dir" log --oneline -"$detras" | sed 's/^/    /'
  else
    echo "· $nombre ($rama): $detras por traer, pero la rama divergió. A mano."
  fi
}

echo "Puesta al día automática (hook SessionStart):"
poner_al_dia "$REPO" "$(basename "$REPO")"

# El vault son notas personales de Lucas y sólo existe en sus máquinas. Si no
# está, esto no imprime nada: para cualquier otra persona el hook es sólo el
# `git fetch` de arriba.
if [ -d "$VAULT/.git" ]; then
  poner_al_dia "$VAULT" "vault"
  echo
  echo "Notas del proyecto en ~/vault (memoria entre sesiones):"
  echo "  · ~/vault/proyectos/  — qué se decidió y por qué"
  echo "  · ~/vault/infra/agenda-mantenimiento.md — 'python3 ~/vault/infra/agenda.py due'"
fi
