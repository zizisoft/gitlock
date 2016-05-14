Gitlock Tags Example
====================

Assume the previous commit has these tags:

```
gitlock-000-sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb
gitlock-001-sha256-f5bcdb592eea42b0f06bdac3cb01ede88ceb6c1c50a966ed534c0662ea162159
```

For the current commit, we make these tags:

Tag `gitlock-000-sha256-9e68a48ff47fe15f6e62cbbbeb1cb3f79b5e067f0582e6773e0513119fb259cd`
-----------------------------------------------------------------------------------------

```
parent sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb

040000 sha256-a25d33b0fc0a61bc3b22174f1b46e5d8ddcc2d16a6ca7e147d46e757365adf99 aaa
100755 sha256-0fd494aa4f12495ad865ecfd7a8b887395304a9ea6ef4442b54574057d05e09c aaa/bin
100644 sha256-38a525a81907f9bc23c11b1475e013fa4b3d084f6db9319c07d49cb68e970d30 bbb
120000 sha256-76c67bc3bc9f088d072f72cddfde05d574887c8bfa6be0c36043708f81f87586 ccc

base64-bWVzc2FnZSBnb2VzIGhlcmU=

nonce 7b2b0ca6e9515eabc2ff1bf9f58db921
```

Note: All files (including those unmodified) are listed. This tag message must end with a Unix newline character. In this example `base64-bWVzc2FnZSBnb2VzIGhlcmU=` is the commit message, while the whole text is the tag message. The SHA-256 value in the tag name is the digest of the tag message.

Tag `gitlock-001-sha256-79765cdc4e0d44c429875f2b9089139dc5d977883beea11286ab428b9ec209a8`
-----------------------------------------------------------------------------------------

```
signatures

parent sha256-9e68a48ff47fe15f6e62cbbbeb1cb3f79b5e067f0582e6773e0513119fb259cd

base64-aiBkc2xmamFzZHY7em94ZGk7IHZqem9kaTtmIHZqYWVyZ3Vwb2VhIHJ1ZzBzWzNldTk1MHdbNHU5dDA5W3d1NDlyMCAzPTFpNHIgXXFpcF1lcmFwd29pZSBmb2E7dWp3ZWY7b2Fqd2k7Zm9qZXM7b2Vmam87YWl3dTR0IG9hO3BlcmdobyA7ZGZqYi9sa3hqIGRrbC9ianhsO2JqIGt4dmNiLnNyO2tmZ2FlZmpsO3NkamZqbHNhIGRsO2tmaiBzYWtsZGpma2xzIGRhcyBqZGZsa2ogc2RqZiBsa2RmIHNkamtsZmEgYTtqIGZvaWV3YTsgZ28zcHU0cDkgdDh5MyBpYXc7ZWkgZmpsYWt3cztqa2RmbGthanNkZ2xrYWpzZGtsZmoga2xzZGogZg==
base64-ZmFqc29pZCBmb2lhcyBqZXJmbGFzamRmDQphIHMNCmRmDQphc2RmDQphc2QNCmYNCg0KYXNkamYgbGthc2pkIGZsazthanNkbGZramFzbGs7ZGZqIG9haXdqc2Vnb2lzO2VqcmcgZjtsc2FkZmxrO2FqcyBkbGtmamFzZGxrO2ZqIGxrYXM7ZGpmIGw7a2FkanMgZmw7YWpzIGRsa2Y7amFzbGRrZmogYXMNCmRmIGE7bA0KanNkZmtsYXM7ZGpmbGs7YXNqZGZsa2phc2RsIGZqbGFzZCBqZmxrYXM7ZGogZiBhb2VpcmdqIGVzOTUgcHlzOWVwdXJnb2lzdWVybDtmZ2tqc2xkaztnamxrc2RqZmxrc2FkZiBhcw==

nonce 1b6ae5ef6ef1a1454dbeab7519909472
```

Note: It signs the previous tag message in UTF-8. This tag message must end with a Unix newline character.

Tag `gitlock-002-sha256-681f7a8b6ea76a7171302bed3d77ecd7496ccb5c5068cb680278f6a8f1bccaa8`
-----------------------------------------------------------------------------------------

```
timestamps

parent sha256-79765cdc4e0d44c429875f2b9089139dc5d977883beea11286ab428b9ec209a8

base64-ZmphbHM7ZGtqZ2xhanNkIGxrZmogYWxza2RqIGZsIDthc2pkZmw7YWprc2w7ZmFqc2VsO2ZqYW9zcmdscmlvcGU1dXQgOTAzODQ3NXQ5MHdlNzRyOTAgN3EzOTQwOG9wd2VydW50aW9zZTtydWdvO2RpcyA7amZnbGs7anNkbGZrZ3M7bGtkZmpnaztsc2RmamdsaztzZGpmbDthamlzZTt3Zmlham93aWdqbztlcmdqO29pc2RqcmxrZ2ogc2RmbGtqZ3Nsa2RmaiBnbGtzZDtmamdsa3NkamZsa2EganNkbGtmamFzbGRramYgYW9pO3dnO3VzZW9pO3Jnam9zZHI7bDtr
base64-amdsc2tkaiByZ29pcztqIGxlZjtqbGlhZXM7ZWpyZ2xpO2Fqd2VzbztmamF3ZWlvO2hpb3RhZXc7cnVodGkzbzR0ODlheTlvYXk4ZWx3ZnlpYWxzZGxma2c7YXNkbGtmO2FzZGxramYgbGs7YXNqZGZsIGtqc2FkbGtmaiBsa2FzamQgZmxrYXNqZjtvaWFyamdsOyBqYXNlbDtnZmlqIG9hdztlanIgZ2Zpb2F3amVvaWYgYXdvO2VpcmZ1IGFvdztlaSBscmE7d2VmanNsa2FzamRmbDtrYXNkaiBsa2Y7ZWlvd2Ygamlhc2lsYWpzIGVs

nonce 019528aa19bacb9c1606d1bd2767954b
```

Note: It timestamps the previous tag message in UTF-8. This tag message must end with a Unix newline character.

When SHA-256 Becomes Weak
=========================

SHA-256 is very strong. It can last several decades. But when the day comes, we can replace it with a new hash algorithm.

For example we replace it with a new hash algorithm `sha3-256`. We delete the old tags, then a new chain begins with the first tag containing the old info. It will be:

Tag `gitlock-000-sha3-256-f6830c0b52941974f21684fc15b7367e524b3f61cf0ff5fdb647b126b7520d51`
-------------------------------------------------------------------------------------------

```
old start

parent sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb

040000 sha256-a25d33b0fc0a61bc3b22174f1b46e5d8ddcc2d16a6ca7e147d46e757365adf99 aaa
100755 sha256-0fd494aa4f12495ad865ecfd7a8b887395304a9ea6ef4442b54574057d05e09c aaa/bin
100644 sha256-38a525a81907f9bc23c11b1475e013fa4b3d084f6db9319c07d49cb68e970d30 bbb
120000 sha256-76c67bc3bc9f088d072f72cddfde05d574887c8bfa6be0c36043708f81f87586 ccc

base64-bWVzc2FnZSBnb2VzIGhlcmU=

nonce 7b2b0ca6e9515eabc2ff1bf9f58db921

signatures

parent sha256-9e68a48ff47fe15f6e62cbbbeb1cb3f79b5e067f0582e6773e0513119fb259cd

base64-aiBkc2xmamFzZHY7em94ZGk7IHZqem9kaTtmIHZqYWVyZ3Vwb2VhIHJ1ZzBzWzNldTk1MHdbNHU5dDA5W3d1NDlyMCAzPTFpNHIgXXFpcF1lcmFwd29pZSBmb2E7dWp3ZWY7b2Fqd2k7Zm9qZXM7b2Vmam87YWl3dTR0IG9hO3BlcmdobyA7ZGZqYi9sa3hqIGRrbC9ianhsO2JqIGt4dmNiLnNyO2tmZ2FlZmpsO3NkamZqbHNhIGRsO2tmaiBzYWtsZGpma2xzIGRhcyBqZGZsa2ogc2RqZiBsa2RmIHNkamtsZmEgYTtqIGZvaWV3YTsgZ28zcHU0cDkgdDh5MyBpYXc7ZWkgZmpsYWt3cztqa2RmbGthanNkZ2xrYWpzZGtsZmoga2xzZGogZg==
base64-ZmFqc29pZCBmb2lhcyBqZXJmbGFzamRmDQphIHMNCmRmDQphc2RmDQphc2QNCmYNCg0KYXNkamYgbGthc2pkIGZsazthanNkbGZramFzbGs7ZGZqIG9haXdqc2Vnb2lzO2VqcmcgZjtsc2FkZmxrO2FqcyBkbGtmamFzZGxrO2ZqIGxrYXM7ZGpmIGw7a2FkanMgZmw7YWpzIGRsa2Y7amFzbGRrZmogYXMNCmRmIGE7bA0KanNkZmtsYXM7ZGpmbGs7YXNqZGZsa2phc2RsIGZqbGFzZCBqZmxrYXM7ZGogZiBhb2VpcmdqIGVzOTUgcHlzOWVwdXJnb2lzdWVybDtmZ2tqc2xkaztnamxrc2RqZmxrc2FkZiBhcw==

nonce 1b6ae5ef6ef1a1454dbeab7519909472

timestamps

parent sha256-79765cdc4e0d44c429875f2b9089139dc5d977883beea11286ab428b9ec209a8

base64-ZmphbHM7ZGtqZ2xhanNkIGxrZmogYWxza2RqIGZsIDthc2pkZmw7YWprc2w7ZmFqc2VsO2ZqYW9zcmdscmlvcGU1dXQgOTAzODQ3NXQ5MHdlNzRyOTAgN3EzOTQwOG9wd2VydW50aW9zZTtydWdvO2RpcyA7amZnbGs7anNkbGZrZ3M7bGtkZmpnaztsc2RmamdsaztzZGpmbDthamlzZTt3Zmlham93aWdqbztlcmdqO29pc2RqcmxrZ2ogc2RmbGtqZ3Nsa2RmaiBnbGtzZDtmamdsa3NkamZsa2EganNkbGtmamFzbGRramYgYW9pO3dnO3VzZW9pO3Jnam9zZHI7bDtr
base64-amdsc2tkaiByZ29pcztqIGxlZjtqbGlhZXM7ZWpyZ2xpO2Fqd2VzbztmamF3ZWlvO2hpb3RhZXc7cnVodGkzbzR0ODlheTlvYXk4ZWx3ZnlpYWxzZGxma2c7YXNkbGtmO2FzZGxramYgbGs7YXNqZGZsIGtqc2FkbGtmaiBsa2FzamQgZmxrYXNqZjtvaWFyamdsOyBqYXNlbDtnZmlqIG9hdztlanIgZ2Zpb2F3amVvaWYgYXdvO2VpcmZ1IGFvdztlaSBscmE7d2VmanNsa2FzamRmbDtrYXNkaiBsa2Y7ZWlvd2Ygamlhc2lsYWpzIGVs

nonce 019528aa19bacb9c1606d1bd2767954b

old end

parent sha3-256-90dd32771833d9094e3e30947c2653151dd3b1923d92468ee882cce3d001abcc

040000 sha3-256-797d4a340a731ff3c60761ec2948b6a6b770202c613e50ba19e1514bbc0eac09 aaa
100755 sha3-256-7ea7f4be4e84ba0a49373e2c45225b0e99341c3dc87487737f2621b102df0f0c aaa/bin
100644 sha3-256-82fdd7c08afe26faf79206be55fc051a276a740bc7b8167a5728634091d200f1 bbb
120000 sha3-256-c2627f382a861abfbcf6bf57b3acf9dd906074363aa30e5c2617b56c05fd405d ccc

base64-bWVzc2FnZSBnb2VzIGhlcmU=

nonce 254020d4dcf6287a76c854788fcdeb82
```

Then, add one or more timestamps:

Tag `gitlock-001-sha3-256-291f86407ee3ade815ec0c68d5ff5bef2cdef7e77f1aae0a9eeed5577db4e827`
-------------------------------------------------------------------------------------------

```
timestamps

parent sha3-256-f6830c0b52941974f21684fc15b7367e524b3f61cf0ff5fdb647b126b7520d51

base64-bGpnbHNqIGdramxzZCBmamxnYSBqc29mIGlqYW93O2VqZm87cyBocmZncHM4ZXV0MHdwNHU1dDA5cHdldXJncHNldXJmb3BzdWp3ZW9mcnUzOXc0cndvb3A4IHUzcjhwcTh1MjAzOXVycW9wMzR1cmVvaXNyO2dzZDtoZmcgbHNqZmw7c2psZmtqIHNsZmtnamxzamZvaXNldWZvM3N1NHQ7aW9zZXJqZztpc2VyaiBnZjtpc2ZpbGdqcztsaXIgamY=

nonce 74ec33fd193f78bf33bad9d3bbca5b93
```

This way, we migrate from SHA-256 to SHA3-256. Later, even if the old hash algorithm is broken, the old info is still valid. Note that we should do the migration before the old hash algorithm is completely broken.

After another several dedades, when the new hash algorithm is retired, there can be nested `old start` and `old end`.

FAQ
====

**Q: Does the SHA-256 lock rely on the SHA-1 commit ID?**

A: No, it doesn't rely on any SHA-1. If it relies on any SHA-1 then the whole structure will be as weak as SHA-1. That's why we must write the hash value in the tag name, because tag names are stored as file name, not in a Git object pointed to by a SHA-1 hash. See your `.git/refs/tags` directory. (The only use for the SHA-1 hash is to quickly find a tag message. After found, it must be validated using the SHA-256 digest in the tag name.)

**Q: Are `000`, `001` and `002` redundant?**

A: Yes, they are redundant to the machine, but more readable to the human.

**Q: Nested `old start` and `old end` is ugly! Why not encode the whole old stuff to Base64, or use JSON?**

A: For avoiding unreasonable size expansion. If use Base64, then imagine there are 100 nested levels (I know it may be after 2000 years, but I want it to have no flaw). Every level will expand by 33%. Finally there will be a huge size. The same goes for JSON, because JSON will escape `"` to `\"`, then to `\\\"`, then to `\\\\\\\"`. It will expand even faster than Base64.
