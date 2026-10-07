"""Public evidence inspection with DNS-pinned sockets and no ambient credentials."""

import asyncio
import ipaddress
import socket
import zlib
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any
from urllib.parse import SplitResult, urljoin, urlsplit, urlunsplit

import anyio
import httpcore
import httpx
from models.roadmap import new_id
from schemas.curriculum import SourceData
from services.file_service import bounded_utf8, extract_reference_text

MAX_SOURCE_BYTES = 2 * 1024 * 1024
Resolver = Callable[[str, int], Awaitable[list[str]]]
TransportFactory = Callable[[str, str], httpx.AsyncBaseTransport]


class SourceFetchError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


def public_address(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return ip.is_global and not ip.is_multicast and not ip.is_unspecified


def validate_source_url(url: str) -> SplitResult:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower()
        if (
            parsed.scheme not in {"http", "https"}
            or not host
            or parsed.username is not None
            or parsed.password is not None
            or parsed.port not in {None, 80, 443}
            or any(ord(character) < 33 for character in url)
            or "\\" in url
            or "%" in host
            or host == "localhost"
            or host.endswith(".localhost")
            or len(url) > 2048
        ):
            raise ValueError()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            if not public_address(host):
                raise ValueError()
        return parsed
    except ValueError:
        raise SourceFetchError(
            "URL_BLOCKED", "Use a public HTTP or HTTPS URL on port 80 or 443"
        ) from None


def canonical_source_url(url: str) -> str:
    parsed = validate_source_url(url.strip())
    host = (parsed.hostname or "").encode("idna").decode("ascii").lower()
    if ":" in host:
        host = f"[{host}]"
    port = parsed.port
    if port is not None and port != (443 if parsed.scheme == "https" else 80):
        host = f"{host}:{port}"
    return urlunsplit((parsed.scheme, host, parsed.path or "/", parsed.query, ""))


async def resolve_public_host(host: str, port: int) -> list[str]:
    results = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(str(result[4][0]) for result in results))


class PinnedBackend(httpcore.AsyncNetworkBackend):
    """Only the TCP address changes; httpcore keeps original Host and TLS SNI."""

    def __init__(
        self, host: str, address: str, *, backend: httpcore.AsyncNetworkBackend | None = None
    ) -> None:
        if not public_address(address):
            raise SourceFetchError("URL_BLOCKED", "This source resolves to a nonpublic address")
        self.host = host.lower()
        self.address = address
        self.backend = backend or httpcore.AnyIOBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,  # noqa: ASYNC109 — httpcore's public backend interface
        local_address: str | None = None,
        socket_options: Iterable[Any] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        if host.lower() != self.host or port not in {80, 443}:
            raise SourceFetchError("URL_BLOCKED", "Connection hostname changed after validation")
        return await self.backend.connect_tcp(
            self.address,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )

    async def connect_unix_socket(
        self,
        path: str,
        timeout: float | None = None,  # noqa: ASYNC109 — httpcore interface
        socket_options: Iterable[Any] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        raise SourceFetchError("URL_BLOCKED", "Local socket connections are disabled")

    async def sleep(self, seconds: float) -> None:
        await self.backend.sleep(seconds)


class CoreResponseStream(httpx.AsyncByteStream):
    def __init__(self, response: httpcore.Response) -> None:
        self.response = response

    async def __aiter__(self) -> AsyncIterator[bytes]:
        async for chunk in self.response.aiter_stream():
            yield chunk

    async def aclose(self) -> None:
        await self.response.aclose()


class PinnedTransport(httpx.AsyncBaseTransport):
    def __init__(self, host: str, address: str) -> None:
        self.pool = httpcore.AsyncConnectionPool(
            network_backend=PinnedBackend(host, address),
            max_connections=1,
            max_keepalive_connections=0,
            retries=0,
        )

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        response = await self.pool.handle_async_request(
            httpcore.Request(
                method=request.method,
                url=httpcore.URL(
                    scheme=request.url.raw_scheme,
                    host=request.url.raw_host,
                    port=request.url.port,
                    target=request.url.raw_path,
                ),
                headers=request.headers.raw,
                content=request.stream,
                extensions=request.extensions,
            )
        )
        return httpx.Response(
            response.status,
            headers=response.headers,
            stream=CoreResponseStream(response),
            extensions=response.extensions,
        )

    async def aclose(self) -> None:
        await self.pool.aclose()


class EvidenceHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self.hidden = 0
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "template", "svg", "iframe"}:
            self.hidden += 1
        if tag == "title":
            self.in_title = True
        if self.hidden == 0 and tag in {"h1", "h2", "h3", "h4", "p", "li", "div", "br", "tr"}:
            self.parts.append(
                "\n" + ("#" * int(tag[1]) + " " if tag in {"h1", "h2", "h3", "h4"} else "")
            )

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "template", "svg", "iframe"}:
            self.hidden = max(0, self.hidden - 1)
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.hidden == 0:
            self.parts.append(data)
            if self.in_title:
                self.title_parts.append(data)


class SourceFetcher:
    def __init__(
        self,
        *,
        resolver: Resolver = resolve_public_host,
        transport_factory: TransportFactory = PinnedTransport,
        timeout_seconds: float = 15,
    ) -> None:
        self.resolver = resolver
        self.transport_factory = transport_factory
        self.timeout_seconds = min(15, max(0.001, timeout_seconds))

    async def fetch(self, url: str) -> SourceData:
        original = canonical_source_url(url)
        try:
            async with asyncio.timeout(self.timeout_seconds):
                return await self._fetch(original)
        except (TimeoutError, httpx.TimeoutException, httpcore.TimeoutException):
            raise SourceFetchError(
                "SOURCE_TIMEOUT", "This source took too long to respond"
            ) from None
        except (httpx.HTTPError, httpcore.NetworkError, httpcore.ProtocolError, OSError):
            raise SourceFetchError(
                "SOURCE_UNAVAILABLE", "This source could not be reached"
            ) from None

    async def _fetch(self, original: str) -> SourceData:
        current = original
        for redirect in range(6):
            parsed = validate_source_url(current)
            host = parsed.hostname or ""
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            addresses = await self.resolver(host, port)
            if not addresses:
                raise SourceFetchError(
                    "SOURCE_UNAVAILABLE", "This source hostname could not be resolved"
                )
            if not all(public_address(address) for address in addresses):
                raise SourceFetchError("URL_BLOCKED", "This source resolves to a nonpublic address")
            # One fresh client per hop: no cookies, proxies, credential forwarding, or implicit DNS.
            async with httpx.AsyncClient(
                transport=self.transport_factory(host, addresses[0]),
                follow_redirects=False,
                trust_env=False,
                timeout=15,
                headers={
                    "Accept": "text/html,text/plain,application/pdf",
                    "Accept-Encoding": "identity",
                    "User-Agent": "GraphMind-Roadmap/1.0",
                },
            ) as client:
                async with client.stream("GET", current) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location or redirect == 5:
                            raise SourceFetchError(
                                "SOURCE_UNAVAILABLE",
                                "This source has too many or invalid redirects",
                            )
                        current = canonical_source_url(urljoin(current, location))
                        continue
                    if not 200 <= response.status_code < 300:
                        raise SourceFetchError(
                            "SOURCE_UNAVAILABLE", "This source does not permit public inspection"
                        )
                    mime = response.headers.get("content-type", "").split(";")[0].lower().strip()
                    if mime not in {"text/html", "text/plain", "application/pdf"}:
                        raise SourceFetchError(
                            "UNSUPPORTED_SOURCE", "Use an HTML, text or text PDF source"
                        )
                    raw = await self._body(response)
                    return await anyio.to_thread.run_sync(
                        self._source,
                        original,
                        current,
                        mime,
                        raw,
                        response.encoding,
                        abandon_on_cancel=True,
                    )
        raise SourceFetchError("SOURCE_UNAVAILABLE", "This source could not be inspected")

    async def _body(self, response: httpx.Response) -> bytes:
        def oversized() -> SourceFetchError:
            return SourceFetchError(
                "SOURCE_SIZE_LIMIT", "This source exceeds the 2MB inspection limit"
            )

        # Mock/preloaded responses have already been decoded by httpx.
        if response.is_stream_consumed:
            if len(response.content) > MAX_SOURCE_BYTES:
                raise oversized()
            return response.content
        encoding = response.headers.get("content-encoding", "identity").lower().strip()
        if encoding not in {"identity", "gzip", "deflate"}:
            raise SourceFetchError(
                "UNSUPPORTED_SOURCE", "This source uses an unsupported content encoding"
            )
        decoder = (
            zlib.decompressobj(31 if encoding == "gzip" else 15) if encoding != "identity" else None
        )
        raw = bytearray()
        received = 0
        try:
            async for chunk in response.aiter_raw():
                received += len(chunk)
                if received > MAX_SOURCE_BYTES:
                    raise oversized()
                decoded = (
                    decoder.decompress(chunk, MAX_SOURCE_BYTES - len(raw) + 1) if decoder else chunk
                )
                if len(raw) + len(decoded) > MAX_SOURCE_BYTES:
                    raise oversized()
                raw.extend(decoded)
            if decoder is not None and (not decoder.eof or decoder.unused_data):
                raise SourceFetchError(
                    "SOURCE_UNAVAILABLE", "This source has invalid compressed content"
                )
        except zlib.error:
            raise SourceFetchError(
                "SOURCE_UNAVAILABLE", "This source has invalid compressed content"
            ) from None
        return bytes(raw)

    def _source(
        self, original: str, final: str, mime: str, data: bytes, encoding: str | None
    ) -> SourceData:
        title = urlsplit(final).hostname or "Public source"
        locators: list[str] = []
        limited = False
        if mime == "text/html":
            parser = EvidenceHTMLParser()
            parser.feed(data.decode(encoding or "utf-8", errors="replace"))
            evidence = "".join(parser.parts).strip()
            title = "".join(parser.title_parts).strip() or title
        else:
            extracted = extract_reference_text(data, mime)
            if extracted.error:
                raise SourceFetchError("SOURCE_UNAVAILABLE", extracted.error)
            evidence = "\n\n".join(f"[{locator}]\n{text}" for locator, text in extracted.sections)
            locators = [locator for locator, _ in extracted.sections]
            limited = extracted.limited
        if not evidence.strip():
            raise SourceFetchError("SOURCE_UNAVAILABLE", "This source contains no readable text")
        evidence_limited = len(evidence.encode()) > 32768
        return SourceData(
            id=new_id("src"),
            title=title[:500],
            url=final,
            status="inspected",
            access="unknown",
            kind="web",
            verified_at=datetime.now(timezone.utc),
            evidence=bounded_utf8(evidence, 32768),
            locator=locators[0] if locators else "Page text",
            provenance={
                "originalUrl": original,
                "finalUrl": final,
                "mime": mime,
                "locators": [locator for locator in locators],
                "extractionLimited": limited or evidence_limited,
                "trust": "untrusted_evidence",
            },
        )
