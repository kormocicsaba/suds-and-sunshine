# Tiny dev server that disables caching so edits always load.
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
H.extensions_map['.js'] = 'text/javascript'
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('', port), H) as s:
    s.serve_forever()
