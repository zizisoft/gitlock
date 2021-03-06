Gitlock Tags Example
====================

Assume the previous commit has these tags:

```
gitlock-000-sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb
gitlock-001-sha256-f5bcdb592eea42b0f06bdac3cb01ede88ceb6c1c50a966ed534c0662ea162159
```

For the current commit, we make these tags:

Tag `gitlock-000-sha256-57a703a19773527148cd1f228b829eab5c740cedfcd1053ba2056cf52782a846`
-----------------------------------------------------------------------------------------

```
parent sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb

040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 aaa
100755 sha256-0fd494aa4f12495ad865ecfd7a8b887395304a9ea6ef4442b54574057d05e09c aaa/bin
100644 sha256-38a525a81907f9bc23c11b1475e013fa4b3d084f6db9319c07d49cb68e970d30 bbb
120000 sha256-76c67bc3bc9f088d072f72cddfde05d574887c8bfa6be0c36043708f81f87586 ccc

commit 148e6fb67ebe6baf574442cb01432440a77c08e7

base64-bWVzc2FnZSBnb2VzIGhlcmU=

nonce 7b2b0ca6e9515eabc2ff1bf9f58db921
```

Note: All files and directories (including those unmodified, also including subdirectories recursively) are listed. This tag message must end with a Unix newline character. In this example `base64-bWVzc2FnZSBnb2VzIGhlcmU=` is the commit message, while the whole text is the tag message. `nonce` is a 128-bit random value. The SHA-256 value in the tag name is the digest of the tag message. Unlike Git, the SHA-256 value in the file list is the raw file's hash without any additions or transforms, so that people can verify your proof more easily.

For a directory, the hash must be all-zero, which has no meaning.

For the first lock, there's no parent, so there should be no parent line (also no empty line after it). If there're 2 or more parents, write multiple parent lines (no empty lines in between). Parent lines can be in any order - no need to strictly follow that in the Git commit object.

If there're no files, then there should be no file list lines (also no empty line after it).

If the commit message is empty, the Base64 line should be `base64-`.

From this model you can find we do allow empty directories, though Git currently prevents it.

Git submodules (if any) are ignored.

All text encodings are UTF-8 without BOM.

Tag `gitlock-001-sha256-a640854d77d93ff5ada8bea3f06e2fc5f93060fb76cc50254081be1a29caeec5`
-----------------------------------------------------------------------------------------

```
signatures

parent sha256-57a703a19773527148cd1f228b829eab5c740cedfcd1053ba2056cf52782a846

base64-aiBkc2xmamFzZHY7em94ZGk7IHZqem9kaTtmIHZqYWVyZ3Vwb2VhIHJ1ZzBzWzNldTk1MHdbNHU5dDA5W3d1NDlyMCAzPTFpNHIgXXFpcF1lcmFwd29pZSBmb2E7dWp3ZWY7b2Fqd2k7Zm9qZXM7b2Vmam87YWl3dTR0IG9hO3BlcmdobyA7ZGZqYi9sa3hqIGRrbC9ianhsO2JqIGt4dmNiLnNyO2tmZ2FlZmpsO3NkamZqbHNhIGRsO2tmaiBzYWtsZGpma2xzIGRhcyBqZGZsa2ogc2RqZiBsa2RmIHNkamtsZmEgYTtqIGZvaWV3YTsgZ28zcHU0cDkgdDh5MyBpYXc7ZWkgZmpsYWt3cztqa2RmbGthanNkZ2xrYWpzZGtsZmoga2xzZGogZg==
base64-ZmFqc29pZCBmb2lhcyBqZXJmbGFzamRmDQphIHMNCmRmDQphc2RmDQphc2QNCmYNCg0KYXNkamYgbGthc2pkIGZsazthanNkbGZramFzbGs7ZGZqIG9haXdqc2Vnb2lzO2VqcmcgZjtsc2FkZmxrO2FqcyBkbGtmamFzZGxrO2ZqIGxrYXM7ZGpmIGw7a2FkanMgZmw7YWpzIGRsa2Y7amFzbGRrZmogYXMNCmRmIGE7bA0KanNkZmtsYXM7ZGpmbGs7YXNqZGZsa2phc2RsIGZqbGFzZCBqZmxrYXM7ZGogZiBhb2VpcmdqIGVzOTUgcHlzOWVwdXJnb2lzdWVybDtmZ2tqc2xkaztnamxrc2RqZmxrc2FkZiBhcw==

nonce 1b6ae5ef6ef1a1454dbeab7519909472
```

Note: It signs the `000` tag message. The `001` tag message must end with a Unix newline character.

Tag `gitlock-002-sha256-b997010750643c49f371cb54821912eeb46c950e8e778b5cf093c9b138966ce4`
-----------------------------------------------------------------------------------------

```
timestamps

parent sha256-a640854d77d93ff5ada8bea3f06e2fc5f93060fb76cc50254081be1a29caeec5

base64-ZmphbHM7ZGtqZ2xhanNkIGxrZmogYWxza2RqIGZsIDthc2pkZmw7YWprc2w7ZmFqc2VsO2ZqYW9zcmdscmlvcGU1dXQgOTAzODQ3NXQ5MHdlNzRyOTAgN3EzOTQwOG9wd2VydW50aW9zZTtydWdvO2RpcyA7amZnbGs7anNkbGZrZ3M7bGtkZmpnaztsc2RmamdsaztzZGpmbDthamlzZTt3Zmlham93aWdqbztlcmdqO29pc2RqcmxrZ2ogc2RmbGtqZ3Nsa2RmaiBnbGtzZDtmamdsa3NkamZsa2EganNkbGtmamFzbGRramYgYW9pO3dnO3VzZW9pO3Jnam9zZHI7bDtr
base64-amdsc2tkaiByZ29pcztqIGxlZjtqbGlhZXM7ZWpyZ2xpO2Fqd2VzbztmamF3ZWlvO2hpb3RhZXc7cnVodGkzbzR0ODlheTlvYXk4ZWx3ZnlpYWxzZGxma2c7YXNkbGtmO2FzZGxramYgbGs7YXNqZGZsIGtqc2FkbGtmaiBsa2FzamQgZmxrYXNqZjtvaWFyamdsOyBqYXNlbDtnZmlqIG9hdztlanIgZ2Zpb2F3amVvaWYgYXdvO2VpcmZ1IGFvdztlaSBscmE7d2VmanNsa2FzamRmbDtrYXNkaiBsa2Y7ZWlvd2Ygamlhc2lsYWpzIGVs

nonce 019528aa19bacb9c1606d1bd2767954b
```

Note: It timestamps the `001` tag message. The `002` tag message must end with a Unix newline character.

When SHA-256 Becomes Weak
=========================

SHA-256 is very strong. It can last several decades. -- BitCoin inventor Satoshi Nakamoto

But when the day comes, we can replace it with a new hash algorithm.

For example we replace it with a new hash algorithm `sha3-256`. We delete the old tags, then a new chain begins with the first tag containing the old info. It will be:

Tag `gitlock-000-sha3-256-029b9f7de2fe39d8834490b88f2b532eae0940f362c58d6f658c58e17170df98`
-------------------------------------------------------------------------------------------

```
old start

parent sha256-b57b6e92da2b3e5bd6ceef80d462a15d9f214e3bd15d77c0dfa0cd72061ed6fb

040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 aaa
100755 sha256-0fd494aa4f12495ad865ecfd7a8b887395304a9ea6ef4442b54574057d05e09c aaa/bin
100644 sha256-38a525a81907f9bc23c11b1475e013fa4b3d084f6db9319c07d49cb68e970d30 bbb
120000 sha256-76c67bc3bc9f088d072f72cddfde05d574887c8bfa6be0c36043708f81f87586 ccc

commit 148e6fb67ebe6baf574442cb01432440a77c08e7

base64-bWVzc2FnZSBnb2VzIGhlcmU=

nonce 7b2b0ca6e9515eabc2ff1bf9f58db921

signatures

parent sha256-57a703a19773527148cd1f228b829eab5c740cedfcd1053ba2056cf52782a846

base64-aiBkc2xmamFzZHY7em94ZGk7IHZqem9kaTtmIHZqYWVyZ3Vwb2VhIHJ1ZzBzWzNldTk1MHdbNHU5dDA5W3d1NDlyMCAzPTFpNHIgXXFpcF1lcmFwd29pZSBmb2E7dWp3ZWY7b2Fqd2k7Zm9qZXM7b2Vmam87YWl3dTR0IG9hO3BlcmdobyA7ZGZqYi9sa3hqIGRrbC9ianhsO2JqIGt4dmNiLnNyO2tmZ2FlZmpsO3NkamZqbHNhIGRsO2tmaiBzYWtsZGpma2xzIGRhcyBqZGZsa2ogc2RqZiBsa2RmIHNkamtsZmEgYTtqIGZvaWV3YTsgZ28zcHU0cDkgdDh5MyBpYXc7ZWkgZmpsYWt3cztqa2RmbGthanNkZ2xrYWpzZGtsZmoga2xzZGogZg==
base64-ZmFqc29pZCBmb2lhcyBqZXJmbGFzamRmDQphIHMNCmRmDQphc2RmDQphc2QNCmYNCg0KYXNkamYgbGthc2pkIGZsazthanNkbGZramFzbGs7ZGZqIG9haXdqc2Vnb2lzO2VqcmcgZjtsc2FkZmxrO2FqcyBkbGtmamFzZGxrO2ZqIGxrYXM7ZGpmIGw7a2FkanMgZmw7YWpzIGRsa2Y7amFzbGRrZmogYXMNCmRmIGE7bA0KanNkZmtsYXM7ZGpmbGs7YXNqZGZsa2phc2RsIGZqbGFzZCBqZmxrYXM7ZGogZiBhb2VpcmdqIGVzOTUgcHlzOWVwdXJnb2lzdWVybDtmZ2tqc2xkaztnamxrc2RqZmxrc2FkZiBhcw==

nonce 1b6ae5ef6ef1a1454dbeab7519909472

timestamps

parent sha256-a640854d77d93ff5ada8bea3f06e2fc5f93060fb76cc50254081be1a29caeec5

base64-ZmphbHM7ZGtqZ2xhanNkIGxrZmogYWxza2RqIGZsIDthc2pkZmw7YWprc2w7ZmFqc2VsO2ZqYW9zcmdscmlvcGU1dXQgOTAzODQ3NXQ5MHdlNzRyOTAgN3EzOTQwOG9wd2VydW50aW9zZTtydWdvO2RpcyA7amZnbGs7anNkbGZrZ3M7bGtkZmpnaztsc2RmamdsaztzZGpmbDthamlzZTt3Zmlham93aWdqbztlcmdqO29pc2RqcmxrZ2ogc2RmbGtqZ3Nsa2RmaiBnbGtzZDtmamdsa3NkamZsa2EganNkbGtmamFzbGRramYgYW9pO3dnO3VzZW9pO3Jnam9zZHI7bDtr
base64-amdsc2tkaiByZ29pcztqIGxlZjtqbGlhZXM7ZWpyZ2xpO2Fqd2VzbztmamF3ZWlvO2hpb3RhZXc7cnVodGkzbzR0ODlheTlvYXk4ZWx3ZnlpYWxzZGxma2c7YXNkbGtmO2FzZGxramYgbGs7YXNqZGZsIGtqc2FkbGtmaiBsa2FzamQgZmxrYXNqZjtvaWFyamdsOyBqYXNlbDtnZmlqIG9hdztlanIgZ2Zpb2F3amVvaWYgYXdvO2VpcmZ1IGFvdztlaSBscmE7d2VmanNsa2FzamRmbDtrYXNkaiBsa2Y7ZWlvd2Ygamlhc2lsYWpzIGVs

nonce 019528aa19bacb9c1606d1bd2767954b

old end

parent sha3-256-90dd32771833d9094e3e30947c2653151dd3b1923d92468ee882cce3d001abcc

040000 sha3-256-0000000000000000000000000000000000000000000000000000000000000000 aaa
100755 sha3-256-7ea7f4be4e84ba0a49373e2c45225b0e99341c3dc87487737f2621b102df0f0c aaa/bin
100644 sha3-256-82fdd7c08afe26faf79206be55fc051a276a740bc7b8167a5728634091d200f1 bbb
120000 sha3-256-c2627f382a861abfbcf6bf57b3acf9dd906074363aa30e5c2617b56c05fd405d ccc

commit 148e6fb67ebe6baf574442cb01432440a77c08e7

base64-bWVzc2FnZSBnb2VzIGhlcmU=

nonce 254020d4dcf6287a76c854788fcdeb82
```

Then, add one or more timestamps:

Tag `gitlock-001-sha3-256-a3b3570d8f6e24f51595e2bc705e3702447e7c3b781e58ae154b70185f189286`
-------------------------------------------------------------------------------------------

```
timestamps

parent sha3-256-029b9f7de2fe39d8834490b88f2b532eae0940f362c58d6f658c58e17170df98

base64-bGpnbHNqIGdramxzZCBmamxnYSBqc29mIGlqYW93O2VqZm87cyBocmZncHM4ZXV0MHdwNHU1dDA5cHdldXJncHNldXJmb3BzdWp3ZW9mcnUzOXc0cndvb3A4IHUzcjhwcTh1MjAzOXVycW9wMzR1cmVvaXNyO2dzZDtoZmcgbHNqZmw7c2psZmtqIHNsZmtnamxzamZvaXNldWZvM3N1NHQ7aW9zZXJqZztpc2VyaiBnZjtpc2ZpbGdqcztsaXIgamY=

nonce 74ec33fd193f78bf33bad9d3bbca5b93
```

This way, we migrate from SHA-256 to SHA3-256. Later, even if the old hash algorithm is broken, the old info is still valid. Note that we should do the migration before the old hash algorithm is completely broken.

After another several dedades, when the new hash algorithm is retired, there can be nested `old start` and `old end`.

Diff Directory Structure
========================

(Note: `c-path` is not implemented yet.)

If it has 1000 files, every tag message will be very big. That's unreasonable. So, we also support another directory structure notation: diff format. All directory structures (including those in `old start` and `old end`) can be in diff format. The diff format is only for storing. While calculating the SHA-256 hash for the tag name, it must use its equivalent full format. So it satisfies both the smaller size for storing and the ease of verifying.

For example, first commit:

```
040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 a
100644 sha256-a0143ab908169aa688632a8c6f2869d0322e1c1dbe46bcaf4563081aace1b716 a/a
100644 sha256-a6e8fd7b89e6b911190c740f8f164a3034d719aab6e389e9ac173c3bf0070bc4 a/b
100644 sha256-7a40a6000885560fdf305b7af97717545c1fd703bed5e803d92409b97778c9cd x
100644 sha256-ae4a652876494f5143f0f6093220341818cbcfa1e634152f526a6d4056a4cb83 y
100644 sha256-c2ebd685e25f5b856dc5e58a987ed0307b316427c977de6f3354559a7c06d1de z
```

Second commit:

```
040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 aaa
100644 sha256-a0143ab908169aa688632a8c6f2869d0322e1c1dbe46bcaf4563081aace1b716 aaa/a
100644 sha256-7a40a6000885560fdf305b7af97717545c1fd703bed5e803d92409b97778c9cd x
100644 sha256-a60cafe440f9b0d66bfc2b486fe93ea0ea1b8fc0fb999a8c09f3cf91b85bcc5e y
100644 sha256-c2ebd685e25f5b856dc5e58a987ed0307b316427c977de6f3354559a7c06d1de z
100644 sha256-7b0a67ab9923dba7524d8e49586671539ff0720f003a81866baac35a3a78f048 z1
```

Third commit:

```
040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 aaa
100644 sha256-a0143ab908169aa688632a8c6f2869d0322e1c1dbe46bcaf4563081aace1b716 aaa/a
100644 sha256-7a40a6000885560fdf305b7af97717545c1fd703bed5e803d92409b97778c9cd x
100644 sha256-3b14d2345b86c5aceb6c9a8bbd9b9385935692b77ba45ceb9b57aa62d2757e5c x1
100644 sha256-a60cafe440f9b0d66bfc2b486fe93ea0ea1b8fc0fb999a8c09f3cf91b85bcc5e y
100644 sha256-c2ebd685e25f5b856dc5e58a987ed0307b316427c977de6f3354559a7c06d1de z
100644 sha256-7b0a67ab9923dba7524d8e49586671539ff0720f003a81866baac35a3a78f048 z1
```

The second can be shortened to:

```
c-path 0 aaa
d 2 1
c 4 1
100644 sha256-a60cafe440f9b0d66bfc2b486fe93ea0ea1b8fc0fb999a8c09f3cf91b85bcc5e y
a 6
100644 sha256-7b0a67ab9923dba7524d8e49586671539ff0720f003a81866baac35a3a78f048 z1
```

The third can be shortened to:

```
a 3
100644 sha256-3b14d2345b86c5aceb6c9a8bbd9b9385935692b77ba45ceb9b57aa62d2757e5c x1
```

The second diff is based on the first full format. The third diff is based on the second diff.

We support 4 actions:

- `a <line-index>` (add)
- `d <line-index> <line-count>` (delete)
- `c <line-index> <line-count>` (change)
- `c-path <line-index> <path>` (change path)

`<line-index>` is a zero-based number. The first line is `0`, not `1`.

Both `<line-index>` and `<line-count>` mean the base, not the target.

For `a`, the `<line-index>` means to insert before this line. To append to the end, set it to the max line index plus 1 (i.e. the total line count). If the base has no line, then `<line-index>` is `0`.

An `a` or `c` line must be followed by one or more file/directory lines.

For now, in `c-path`, the `<line-index>` can only point to an item of mode `040000`. The `<path>` must be the full path. So, if you want to rename the directory `a/b/c` to `a/b/c1`, then `<path>` should be `a/b/c1`, not `c1`.

Apart from renaming, `c-path` also helps if you want to move directories. For example, to change `a/x` to `c/x` (i.e. move directory `x` from `a` to `c`), simply set `<path>` to `c/x`. So `c-path` is similar to the Bash `mv` command.

If applying to mode `040000` (presently the only allowed use), `c-path` will change all items related to this directory, not only the `040000` item.

There can be multiple `c-path` fields. `c-path` must appear at the top. On restoring the full format, it will first apply `c-path`, then apply the other diffs.

If it has multiple parents, the diff is based on the first parent. So it's better to set the first parent to be that giving the smallest diff.

If there's no diff (committed using `--allow-empty`), then the diff should be a single line with the content `no-diff`.

Code Terminology
================

This section governs the naming conventions in the code.

Unless otherwise specified, "hash" means our SHA-256 hash string, including the `sha256-` prefix.

Unless otherwise specified, ID means the Git object's SHA-1 hash string. Commit is a concept (or object), not a string. But commit ID is a string.

"File" can also mean a directory. File is a concept (or object), not a string. File path is a string.

The first lock for a commit is called the base lock. Subsequent locks for this commit are called derived locks.

Lock name is the string starting with `gitlock-` (tag name). Lock content is usually the tag message, but when using diff, the lock content is the diff-applied version, while the tag message is called the stored lock content. Lock is a concept (or object), not a string.

Time is an ISO-8601 string, not a `Date` object or a number.

But, for JSON that is to be stored, we can make it shorter, such as "commit ID" to "commit", because in JSON this field must be string, without ambiguity (can't be object).

The `000`, `001` in the lock name is called label.

Cache can mean memory cache or program data cache, but if omitted it usually means memory cache.

FAQ
====

**Q: Does the SHA-256 lock rely on the SHA-1 commit ID?**

A: No, it doesn't rely on any SHA-1. If it relies on any SHA-1 then the whole structure will be as weak as SHA-1. That's why we must write the hash value in the tag name, because tag names are stored as file name, not in a Git object pointed to by a SHA-1 hash. See your `.git/refs/tags` directory. In `gitlock-000` tag there's a field showing the SHA-1 commit ID, but this field is just informative (if somebody viewing your proof also trusts SHA-1 that's nice) and simply redundant. It doesn't use this field to verify anything. (The only use for the SHA-1 hash is to quickly find a tag message. After found, it must be validated using the SHA-256 digest in the tag name.)

**Q: Are `000`, `001` and `002` redundant?**

A: Yes, they are redundant to the machine, but more readable to the human.

**Q: Nested `old start` and `old end` is ugly! Why not encode the whole old stuff to Base64, or use JSON?**

A: For avoiding unreasonable size expansion. If use Base64, then imagine there are 100 nested levels (I know it may be after 2000 years, but I want it to have no flaw). Every level will expand by 33%. Finally there will be a huge size. The same goes for JSON, because JSON will escape `"` to `\"`, then to `\\\"`, then to `\\\\\\\"`. It will expand even faster than Base64.

**Q: Why is there a `nonce`?**

A: Sometimes, if working on two branches, two commits may have the same content. Without `nonce`, if the two locks have the same parent or their parents have the same content, it will result in duplicate tag name.

**Q: Why are submodules ignored?**

A: Submodules may be maintained by other people. It's very likely that other people don't use GitLock so that there's no lock to point to. Also, we can't point to the SHA-1 commit ID for security reasons. In addition, recursive submodules will increase the complexity. But in the future, we may support adding submodules (if they are locked).
