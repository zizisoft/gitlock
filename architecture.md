Gitlock Tags Example
====================

Assume the previous commit has these tags:

```
gitlock-000-sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb
gitlock-001-sha256-f5bcdb592eea42b0f06bdac3cb01ede88ceb6c1c50a966ed534c0662ea162159
```

For the current commit, we make these tags:

Tag `gitlock-000-sha256-2b0fd45976b0a47d38b934bf51a99bba8996cfc5bed47f65b0250ee29d08455d`
-----------------------------------------------------------------------------------------

```
parent sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb

040000 sha256-a25d33b0fc0a61bc3b22174f1b46e5d8ddcc2d16a6ca7e147d46e757365adf99 aaa
100755 sha256-0fd494aa4f12495ad865ecfd7a8b887395304a9ea6ef4442b54574057d05e09c aaa/bin
100644 sha256-38a525a81907f9bc23c11b1475e013fa4b3d084f6db9319c07d49cb68e970d30 bbb
120000 sha256-76c67bc3bc9f088d072f72cddfde05d574887c8bfa6be0c36043708f81f87586 ccc

message goes here
```

Note: All files (including those unmodified) are listed. This tag message must end with a Unix newline character. In this example `message goes here` is the commit message, while the whole text is the tag message. The SHA-256 value in the tag name is the digest of the tag message.

Tag `gitlock-001-sha256-d82b816f802e95e4b85a4105d67d42d103f20d5a32fd029d953f48a66496dd71`
-----------------------------------------------------------------------------------------

```
signatures

base64-aiBkc2xmamFzZHY7em94ZGk7IHZqem9kaTtmIHZqYWVyZ3Vwb2VhIHJ1ZzBzWzNldTk1MHdbNHU5dDA5W3d1NDlyMCAzPTFpNHIgXXFpcF1lcmFwd29pZSBmb2E7dWp3ZWY7b2Fqd2k7Zm9qZXM7b2Vmam87YWl3dTR0IG9hO3BlcmdobyA7ZGZqYi9sa3hqIGRrbC9ianhsO2JqIGt4dmNiLnNyO2tmZ2FlZmpsO3NkamZqbHNhIGRsO2tmaiBzYWtsZGpma2xzIGRhcyBqZGZsa2ogc2RqZiBsa2RmIHNkamtsZmEgYTtqIGZvaWV3YTsgZ28zcHU0cDkgdDh5MyBpYXc7ZWkgZmpsYWt3cztqa2RmbGthanNkZ2xrYWpzZGtsZmoga2xzZGogZg==
base64-ZmFqc29pZCBmb2lhcyBqZXJmbGFzamRmDQphIHMNCmRmDQphc2RmDQphc2QNCmYNCg0KYXNkamYgbGthc2pkIGZsazthanNkbGZramFzbGs7ZGZqIG9haXdqc2Vnb2lzO2VqcmcgZjtsc2FkZmxrO2FqcyBkbGtmamFzZGxrO2ZqIGxrYXM7ZGpmIGw7a2FkanMgZmw7YWpzIGRsa2Y7amFzbGRrZmogYXMNCmRmIGE7bA0KanNkZmtsYXM7ZGpmbGs7YXNqZGZsa2phc2RsIGZqbGFzZCBqZmxrYXM7ZGogZiBhb2VpcmdqIGVzOTUgcHlzOWVwdXJnb2lzdWVybDtmZ2tqc2xkaztnamxrc2RqZmxrc2FkZiBhcw==
```

Note: It signs the previous tag message in UTF-8. This tag message must end with a Unix newline character.

Tag `gitlock-002-sha256-752e9fb514679ebe7aa84f503fea22da1e646dd1314d7cbfc73b852940855fe0`
-----------------------------------------------------------------------------------------

```
timestamps

base64-ZmphbHM7ZGtqZ2xhanNkIGxrZmogYWxza2RqIGZsIDthc2pkZmw7YWprc2w7ZmFqc2VsO2ZqYW9zcmdscmlvcGU1dXQgOTAzODQ3NXQ5MHdlNzRyOTAgN3EzOTQwOG9wd2VydW50aW9zZTtydWdvO2RpcyA7amZnbGs7anNkbGZrZ3M7bGtkZmpnaztsc2RmamdsaztzZGpmbDthamlzZTt3Zmlham93aWdqbztlcmdqO29pc2RqcmxrZ2ogc2RmbGtqZ3Nsa2RmaiBnbGtzZDtmamdsa3NkamZsa2EganNkbGtmamFzbGRramYgYW9pO3dnO3VzZW9pO3Jnam9zZHI7bDtr
base64-amdsc2tkaiByZ29pcztqIGxlZjtqbGlhZXM7ZWpyZ2xpO2Fqd2VzbztmamF3ZWlvO2hpb3RhZXc7cnVodGkzbzR0ODlheTlvYXk4ZWx3ZnlpYWxzZGxma2c7YXNkbGtmO2FzZGxramYgbGs7YXNqZGZsIGtqc2FkbGtmaiBsa2FzamQgZmxrYXNqZjtvaWFyamdsOyBqYXNlbDtnZmlqIG9hdztlanIgZ2Zpb2F3amVvaWYgYXdvO2VpcmZ1IGFvdztlaSBscmE7d2VmanNsa2FzamRmbDtrYXNkaiBsa2Y7ZWlvd2Ygamlhc2lsYWpzIGVs
```

Note: It timestamps the previous tag message in UTF-8. This tag message must end with a Unix newline character.

When SHA-256 Becomes Weak
=========================

SHA-256 is very strong. It can last several decades. But when the day comes, we can replace it with a new hash algorithm.

For example we replace it with a new hash algorithm `sha3-256`. First, for every old tag, write the tag message, like this:

```
parent sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb

040000 sha256-a25d33b0fc0a61bc3b22174f1b46e5d8ddcc2d16a6ca7e147d46e757365adf99 aaa
100755 sha256-0fd494aa4f12495ad865ecfd7a8b887395304a9ea6ef4442b54574057d05e09c aaa/bin
100644 sha256-38a525a81907f9bc23c11b1475e013fa4b3d084f6db9319c07d49cb68e970d30 bbb
120000 sha256-76c67bc3bc9f088d072f72cddfde05d574887c8bfa6be0c36043708f81f87586 ccc

message goes here
```

Then convert it to base64:

```
cGFyZW50IHNoYTI1Ni1iNTdiNmU5MmRhMmIzZTViZDZjZWVmODBkNDYyYTE1ZDlmMjE0ZTNiZDE1ZDc3YzBkZmEwY2Q3MjA2MWVkNmZiDQoNCjA0MDAwMCBzaGEyNTYtYTI1ZDMzYjBmYzBhNjFiYzNiMjIxNzRmMWI0NmU1ZDhkZGNjMmQxNmE2Y2E3ZTE0N2Q0NmU3NTczNjVhZGY5OSBhYWENCjEwMDc1NSBzaGEyNTYtMGZkNDk0YWE0ZjEyNDk1YWQ4NjVlY2ZkN2E4Yjg4NzM5NTMwNGE5ZWE2ZWY0NDQyYjU0NTc0MDU3ZDA1ZTA5YyBhYWEvYmluDQoxMDA2NDQgc2hhMjU2LTM4YTUyNWE4MTkwN2Y5YmMyM2MxMWIxNDc1ZTAxM2ZhNGIzZDA4NGY2ZGI5MzE5YzA3ZDQ5Y2I2OGU5NzBkMzAgYmJiDQoxMjAwMDAgc2hhMjU2LTc2YzY3YmMzYmM5ZjA4OGQwNzJmNzJjZGRmZGUwNWQ1NzQ4ODdjOGJmYTZiZTBjMzYwNDM3MDhmODFmODc1ODYgY2NjDQoNCm1lc3NhZ2UgZ29lcyBoZXJlDQo=
```

For every old tag, repeat these steps. We delete the old tags, and a new chain begins with the first tag containing the old info. So it will be:

Tag `gitlock-000-sha3-256-a11cd9bd798cd93ded6537fd3d83247ccb6e3d6bbe6a0190be6a9e80f495a05a`
-------------------------------------------------------------------------------------------

```
base64-cGFyZW50IHNoYTI1Ni1iNTdiNmU5MmRhMmIzZTViZDZjZWVmODBkNDYyYTE1ZDlmMjE0ZTNiZDE1ZDc3YzBkZmEwY2Q3MjA2MWVkNmZiDQoNCjA0MDAwMCBzaGEyNTYtYTI1ZDMzYjBmYzBhNjFiYzNiMjIxNzRmMWI0NmU1ZDhkZGNjMmQxNmE2Y2E3ZTE0N2Q0NmU3NTczNjVhZGY5OSBhYWENCjEwMDc1NSBzaGEyNTYtMGZkNDk0YWE0ZjEyNDk1YWQ4NjVlY2ZkN2E4Yjg4NzM5NTMwNGE5ZWE2ZWY0NDQyYjU0NTc0MDU3ZDA1ZTA5YyBhYWEvYmluDQoxMDA2NDQgc2hhMjU2LTM4YTUyNWE4MTkwN2Y5YmMyM2MxMWIxNDc1ZTAxM2ZhNGIzZDA4NGY2ZGI5MzE5YzA3ZDQ5Y2I2OGU5NzBkMzAgYmJiDQoxMjAwMDAgc2hhMjU2LTc2YzY3YmMzYmM5ZjA4OGQwNzJmNzJjZGRmZGUwNWQ1NzQ4ODdjOGJmYTZiZTBjMzYwNDM3MDhmODFmODc1ODYgY2NjDQoNCm1lc3NhZ2UgZ29lcyBoZXJlDQo=
base64-c2lnbmF0dXJlcw0KDQpiYXNlNjQtYWlCa2MyeG1hbUZ6WkhZN2VtOTRaR2s3SUhacWVtOWthVHRtSUhacVlXVnlaM1Z3YjJWaElISjFaekJ6V3pObGRUazFNSGRiTkhVNWREQTVXM2QxTkRseU1DQXpQVEZwTkhJZ1hYRnBjRjFsY21Gd2QyOXBaU0JtYjJFN2RXcDNaV1k3YjJGcWQyazdabTlxWlhNN2IyVm1hbTg3WVdsM2RUUjBJRzloTzNCbGNtZG9ieUE3WkdacVlpOXNhM2hxSUdScmJDOWlhbmhzTzJKcUlHdDRkbU5pTG5OeU8ydG1aMkZsWm1wc08zTmthbVpxYkhOaElHUnNPMnRtYWlCellXdHNaR3BtYTJ4eklHUmhjeUJxWkdac2Eyb2djMlJxWmlCc2EyUm1JSE5rYW10c1ptRWdZVHRxSUdadmFXVjNZVHNnWjI4emNIVTBjRGtnZERoNU15QnBZWGM3WldrZ1ptcHNZV3QzY3p0cWEyUm1iR3RoYW5Oa1oyeHJZV3B6Wkd0c1ptb2dhMnh6WkdvZ1pnPT0NCmJhc2U2NC1abUZxYzI5cFpDQm1iMmxoY3lCcVpYSm1iR0Z6YW1SbURRcGhJSE1OQ21SbURRcGhjMlJtRFFwaGMyUU5DbVlOQ2cwS1lYTmthbVlnYkd0aGMycGtJR1pzYXp0aGFuTmtiR1pyYW1GemJHczdaR1pxSUc5aGFYZHFjMlZuYjJsek8yVnFjbWNnWmp0c2MyRmtabXhyTzJGcWN5QmtiR3RtYW1GelpHeHJPMlpxSUd4cllYTTdaR3BtSUd3N2EyRmthbk1nWm13N1lXcHpJR1JzYTJZN2FtRnpiR1JyWm1vZ1lYTU5DbVJtSUdFN2JBMEthbk5rWm10c1lYTTdaR3BtYkdzN1lYTnFaR1pzYTJwaGMyUnNJR1pxYkdGelpDQnFabXhyWVhNN1pHb2daaUJoYjJWcGNtZHFJR1Z6T1RVZ2NIbHpPV1Z3ZFhKbmIybHpkV1Z5YkR0bVoydHFjMnhrYXp0bmFteHJjMlJxWm14cmMyRmtaaUJoY3c9PQ0K
base64-dGltZXN0YW1wcw0KDQpiYXNlNjQtWm1waGJITTdaR3RxWjJ4aGFuTmtJR3hyWm1vZ1lXeHphMlJxSUdac0lEdGhjMnBrWm13N1lXcHJjMnc3Wm1GcWMyVnNPMlpxWVc5emNtZHNjbWx2Y0dVMWRYUWdPVEF6T0RRM05YUTVNSGRsTnpSeU9UQWdOM0V6T1RRd09HOXdkMlZ5ZFc1MGFXOXpaVHR5ZFdkdk8yUnBjeUE3YW1abmJHczdhbk5rYkdaclozTTdiR3RrWm1wbmF6dHNjMlJtYW1kc2F6dHpaR3BtYkR0aGFtbHpaVHQzWm1saGFtOTNhV2RxYnp0bGNtZHFPMjlwYzJScWNteHJaMm9nYzJSbWJHdHFaM05zYTJSbWFpQm5iR3R6WkR0bWFtZHNhM05rYW1ac2EyRWdhbk5rYkd0bWFtRnpiR1JyYW1ZZ1lXOXBPM2RuTzNWelpXOXBPM0puYW05elpISTdiRHRyDQpiYXNlNjQtYW1kc2MydGthaUJ5WjI5cGN6dHFJR3hsWmp0cWJHbGhaWE03WldweVoyeHBPMkZxZDJWemJ6dG1hbUYzWldsdk8yaHBiM1JoWlhjN2NuVm9kR2t6YnpSME9EbGhlVGx2WVhrNFpXeDNabmxwWVd4elpHeG1hMmM3WVhOa2JHdG1PMkZ6Wkd4cmFtWWdiR3M3WVhOcVpHWnNJR3RxYzJGa2JHdG1haUJzYTJGemFtUWdabXhyWVhOcVpqdHZhV0Z5YW1kc095QnFZWE5sYkR0blptbHFJRzloZHp0bGFuSWdaMlpwYjJGM2FtVnZhV1lnWVhkdk8yVnBjbVoxSUdGdmR6dGxhU0JzY21FN2QyVm1hbk5zYTJGemFtUm1iRHRyWVhOa2FpQnNhMlk3WldsdmQyWWdhbWxoYzJsc1lXcHpJR1ZzDQo=

parent sha3-256-90dd32771833d9094e3e30947c2653151dd3b1923d92468ee882cce3d001abcc

040000 sha3-256-797d4a340a731ff3c60761ec2948b6a6b770202c613e50ba19e1514bbc0eac09 aaa
100755 sha3-256-7ea7f4be4e84ba0a49373e2c45225b0e99341c3dc87487737f2621b102df0f0c aaa/bin
100644 sha3-256-82fdd7c08afe26faf79206be55fc051a276a740bc7b8167a5728634091d200f1 bbb
120000 sha3-256-c2627f382a861abfbcf6bf57b3acf9dd906074363aa30e5c2617b56c05fd405d ccc

message goes here
```

Then, add one or more timestamps:

Tag `gitlock-001-sha3-256-9f5a93cc388fb26ad73f6cf0c5f474eb03ff6a37a7c6ce9881ca0664ddf13b94`
-------------------------------------------------------------------------------------------

```
timestamps

base64-bGpnbHNqIGdramxzZCBmamxnYSBqc29mIGlqYW93O2VqZm87cyBocmZncHM4ZXV0MHdwNHU1dDA5cHdldXJncHNldXJmb3BzdWp3ZW9mcnUzOXc0cndvb3A4IHUzcjhwcTh1MjAzOXVycW9wMzR1cmVvaXNyO2dzZDtoZmcgbHNqZmw7c2psZmtqIHNsZmtnamxzamZvaXNldWZvM3N1NHQ7aW9zZXJqZztpc2VyaiBnZjtpc2ZpbGdqcztsaXIgamY=
```

This way, we migrate from SHA-256 to SHA3-256. Later, even if the old hash algorithm is broken, the old info is still valid. Note that we should do the migration before the old hash algorithm is completely broken.
