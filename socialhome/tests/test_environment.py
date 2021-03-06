from unittest.mock import Mock

import redis
import requests

from socialhome.tests.utils import SocialhomeTestCase


class TestEnvironment(SocialhomeTestCase):
    def test_requests_mocks(self):
        self.assertTrue(isinstance(requests.get, Mock))
        self.assertTrue(isinstance(requests.put, Mock))
        self.assertTrue(isinstance(requests.post, Mock))
        self.assertTrue(isinstance(requests.patch, Mock))
        self.assertTrue(isinstance(requests.delete, Mock))

    def test_redis(self):
        self.assertTrue(isinstance(redis.StrictRedis, Mock))
