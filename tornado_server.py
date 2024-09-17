import tornado.ioloop
import tornado.web
import tornado.gen
import tornado.websocket
import asyncio
import requests
import datetime
import json
import uuid

class WebSocketHandler(tornado.websocket.WebSocketHandler):
    waiters = set()

    def open(self):
        WebSocketHandler.waiters.add(self)
        print(f"Client connected: {self.request.remote_ip}")

    def on_close(self):
        WebSocketHandler.waiters.remove(self)
        print(f"Client disconnected: {self.request.remote_ip}")

    @classmethod
    def send_message(cls, message):
        for waiter in cls.waiters:
            waiter.write_message(message)

    def on_message(self, message):
        # Resolve the future with the received HTML response
        message_data = json.loads(message)
        future_id = message_data.get('future_id')
        future = GetHtmlHandler.futures.get(future_id)
        if future and not future.done():
            future.set_result(message_data.get('html'))


class GetHtmlHandler(tornado.web.RequestHandler):
    futures = {}

    @tornado.gen.coroutine
    def get(self):
        url = self.get_argument('url')
        future = asyncio.Future()
        future_id = str(uuid.uuid4())  # Assign a unique ID to the future
        GetHtmlHandler.futures[future_id] = future

        if WebSocketHandler.waiters:
            WebSocketHandler.send_message(json.dumps({'url': url, 'future_id': future_id}))
        else:
            self.set_status(503)
            self.write("Error: No WebSocket clients available to process the request")
            return

        try:
            html = yield tornado.gen.with_timeout(datetime.timedelta(milliseconds=5000), future)
            self.write(f"<!DOCTYPE html>{html}")
        except tornado.gen.TimeoutError:
            self.set_status(504)
            self.write("Request timed out")
        except Exception as e:
            self.set_status(500)
            self.write(f"Error: {str(e)}")

        # Resolve the future after receiving the response from WebSocketHandler
        future.add_done_callback(lambda f: GetHtmlHandler.futures.pop(future_id, None))


def make_app():
    return tornado.web.Application([
        (r"/get_html", GetHtmlHandler),
        (r"/websocket", WebSocketHandler),
    ])

if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()

