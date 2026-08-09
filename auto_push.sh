DIR="."
echo "Monitoreando cambios en $DIR..."

inotifywait -m -r -e modify,create,delete,move "$DIR" --exclude '\.git' | while read -r directory events filename; do
    echo "Cambio detectado en $filename ($events). Subiendo a GitHub..."
    sleep 3
    git add .
    git commit -m "Auto-update: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main
    echo "Cambios sincronizados correctamente."
done
