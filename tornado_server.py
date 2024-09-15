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

    def on_close(self):
        WebSocketHandler.waiters.remove(self)

    @classmethod
    def send_message(cls, message):
        for waiter in cls.waiters:
            waiter.write_message(message)

    def on_message(self, message):
        # Resolve the future with the received HTML response
        message_data = json.loads(message)
        future_id = message_data.get('future_id')
        for future in list(GetHtmlHandler.futures):
            if not future.done() and future.id == future_id:
                future.set_result(message_data.get('html'))

class GetHtmlHandler(tornado.web.RequestHandler):
    futures = set()

    @tornado.gen.coroutine
    def get(self):
        url = self.get_argument('url')
        future = asyncio.Future()
        future.id = str(uuid.uuid4())  # Assign a unique ID to the future
        GetHtmlHandler.futures.add(future)

        def fetch_html():
            try:
                WebSocketHandler.send_message(json.dumps({'url': url, 'future_id': future.id}))
                response = yield tornado.gen.with_timeout(datetime.timedelta(milliseconds=5000), future)
                future.set_result(response)
            except Exception as e:
                future.set_exception(e)

        tornado.ioloop.IOLoop.current().add_callback(fetch_html)

        try:
            html = yield tornado.gen.with_timeout(datetime.timedelta(milliseconds=5000), future)
            self.write(html)
        except tornado.gen.TimeoutError:
            self.set_status(504)
            self.write("Request timed out")
        except Exception as e:
            self.set_status(500)
            self.write(f"Error: {str(e)}")

        # Resolve the future after receiving the response from WebSocketHandler
        future.add_done_callback(lambda f: GetHtmlHandler.futures.remove(future))

def make_app():
    return tornado.web.Application([
        (r"/get_html", GetHtmlHandler),
        (r"/websocket", WebSocketHandler),
    ])

if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()
