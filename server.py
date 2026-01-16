#!/usr/bin/env python3
"""
HTTP сервер с отключенным кэшированием для разработки.
Гарантирует, что браузер всегда загружает свежую версию файлов.
"""

import http.server
import socketserver
import os
from datetime import datetime

PORT = 8000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP обработчик, который отправляет заголовки для отключения кэширования."""
    
    def end_headers(self):
        # Добавляем заголовки для предотвращения кэширования
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Добавляем Last-Modified для проверки изменений
        if os.path.exists(self.path.lstrip('/')):
            try:
                mtime = os.path.getmtime(self.path.lstrip('/'))
                self.send_header('Last-Modified', self.date_time_string(mtime))
            except OSError:
                pass
        super().end_headers()
    
    def log_message(self, format, *args):
        """Логирует запросы с временной меткой."""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] {format % args}")

def main():
    """Запускает HTTP сервер на указанном порту."""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"Сервер запущен на http://localhost:{PORT}/")
        print(f"Рабочая директория: {os.getcwd()}")
        print("Кэширование отключено - изменения будут видны после обновления страницы")
        print("Для остановки нажмите Ctrl+C\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nСервер остановлен.")

if __name__ == "__main__":
    main()
