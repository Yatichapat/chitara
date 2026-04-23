from django.conf import settings

from .base import SongGeneratorStrategy


class SunoSongGeneratorStrategy(SongGeneratorStrategy):
    BASE_URL = "https://api.sunoapi.org/api/v1"

    def _nested_data(self, payload):
        data = payload.get("data")
        return data if isinstance(data, dict) else {}

    def _extract_task_id(self, payload):
        if not isinstance(payload, dict):
            return None

        direct_task_id = payload.get("taskId") or payload.get("task_id")
        if direct_task_id:
            return direct_task_id

        nested_data = self._nested_data(payload)
        nested_task_id = nested_data.get("taskId") or nested_data.get("task_id")
        if nested_task_id:
            return nested_task_id

        nested_payload = nested_data.get("data")
        if isinstance(nested_payload, dict):
            return self._extract_task_id(nested_payload)

        return None

    def _requests_module(self):
        try:
            import requests
        except ImportError as exc:
            raise RuntimeError(
                "The 'requests' package is required for the Suno generator."
            ) from exc

        return requests

    def _headers(self):
        return {
            "Authorization": f"Bearer {settings.SUNO_API_KEY}",
            "Content-Type": "application/json",
        }

    def _callback_url(self):
        return getattr(settings, "SUNO_CALLBACK_URL", "").strip()

    def _raise_for_api_error(self, data):
        if not isinstance(data, dict):
            raise ValueError("Unexpected response from Suno API.")

        if data.get("code") in (None, 0, 200):
            return

        message = data.get("msg") or "Suno API request failed."
        raise ValueError(message)

    def generate(self, request_data: dict) -> dict:
        requests = self._requests_module()
        payload = {
            "customMode": True,
            "instrumental": True,
            "model": "V4_5",
            "prompt": request_data["prompt"],
            "style": f'{request_data["genre"]}, {request_data["mood"]}',
            "title": request_data.get("title"),
        }
        callback_url = self._callback_url()
        if callback_url:
            payload["callBackUrl"] = callback_url

        res = requests.post(
            f"{self.BASE_URL}/generate",
            json=payload,
            headers=self._headers(),
            timeout=30,
        )
        res.raise_for_status()
        data = res.json()
        self._raise_for_api_error(data)
        task_id = self._extract_task_id(data)
        if not task_id:
            raise ValueError("Suno API response did not include a taskId.")

        return {
            "task_id": task_id,
            "status": "pending",
            "raw_response": data,
        }

    def get_status(self, task_id: str) -> dict:
        requests = self._requests_module()
        res = requests.get(
            f"{self.BASE_URL}/generate/record-info",
            params={"taskId": task_id},
            headers=self._headers(),
            timeout=30,
        )
        res.raise_for_status()
        data = res.json()
        nested_data = self._nested_data(data)
        provider_status = nested_data.get("status")

        return {
            "task_id": task_id,
            "status": provider_status,
            "raw_response": data,
        }
