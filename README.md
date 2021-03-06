GitLock
=======

GitLock adds a SHA-256 wrapper to increase the security of Git, and protects your copyright by adding timestamps from trusted authorities.

Please consider using GitLock if:

- You're not satisfied with Git's SHA-1 security, which is [near broken](https://www.schneier.com/blog/archives/2015/10/sha-1_freestart.html);
- You want to protect your copyright;
- Or you hate to input messages of every commits in personal repos.

IMPORTANT: **How to prove your code is yours?** The only way is to prove that you are the **first** one who claims its copyright. That's exactly what timestamps do. GitLock's timestamp isn't from your computer. It's from well-known CAs, such as Comodo, which can be trusted.

In essence, GitLock just adds tags. It doesn't modify your repo's internals, so it's safe - Your history and commit IDs will remain unchanged. It's compatible with Git (1.8.3 or higher), GitHub, and BitBucket. For details see "architecture.md". Take a brief look at the effect after locked:

- [Example lock list](https://github.com/zizisoft/gitlock/tags?after=gitlock-000-sha256-4e8abc37d6efd2f054aea3da5f10a6f7421fc5b9e09e5b4373ae08596e1b26ca) (Click `...` to see lock details. Note that year 2005 isn't the timestamp date - it's just a fake date to isolate locks from releases for readability.)
- [Example commit with locks](https://github.com/zizisoft/gitlock/commit/1758cba8f9e2128e601dc3952110559a1b29a021)
- [Example base lock](https://github.com/zizisoft/gitlock/releases/tag/gitlock-000-sha256-3da0b41c4dfe1ea226095e05ed73a2355fce9a70a0368ae10d90568342cc7332)
- [Example timestamp lock](https://github.com/zizisoft/gitlock/releases/tag/gitlock-001-sha256-936fa8afe109de575e4e2ffc6758ac786d3fb7b8d48efafbee0c072b363201f5)

There're 3 types of locks: base lock (with label `000`), timestamp lock, and signature lock (signature locks are not implemented yet).

(Windows users: It's recommended to run GitLock in Git Bash, not `cmd`, because it relies on OpenSSL.)

Installation
============

- Make sure you have [Node.js](https://nodejs.org/) on your computer.
- Use the command `npm install -g gitlock` (may need `sudo`) to install GitLock.

Usage
=====

### Synopsis 1: basic commands

```
gitlock
gitlock -m <commit-message>
gitlock commit
gitlock commit ...
```

Base lock. If there're files in the index but not committed, it will commit before locking.

It locks every commit between the current branch (the HEAD commit) and the very first commit of the repo.

If `gitlock` without any arguments, when committing, the message will be empty. This is handy for programmers who don't want to input messages, though it's not a good habit in collaborative projects.

If `gitlock commit`, when committing it will show an editor, like `git commit`.

If `gitlock commit ...`, it's equivalent to `git commit ...` then `gitlock`.

`gitlock -m <commit-message>` is a shorthand for `gitlock commit -m <commit-message>`.

Note that on the first time running it may take some minutes, because it will lock all history commits.

After locked, it can automatically sign or timestamp based on your configuration.

### Synopsis 2 (not implemented yet): sign

```
gitlock sign
```

Sign the current lock.

Note: If you just want to prove your copyright, you really don't need to sign. Providing  your name and email in a file (like `package.json`) in your repo and then timestamping is enough. This is obvious, because signing is for liability / authentication, not for claiming rights. If you're still not confident, provide more information like your birthday, nationality and passport number in a file (like `author-info.txt`) before timestamping.

If it hasn't been locked, it will lock first.

### Synopsis 3: timestamp

```
gitlock timestamp
```

Add a trusted timestamp to the current lock. If it hasn't been locked, it will lock first.

You don't need to timestamp every lock / commit, as the timestamp can prove that every preceding lock / commit happened before the time.

IMPORTANT: If your repo is public, you should timestamp before push. Timestamping after push is weak.

### Synopsis 4: push

```
gitlock push
```

Push commits and their tags (including locks). Before push, it can automatically sign or timestamp based on your configuration. There will be a "secure delay". See FAQ.

If it hasn't been locked, it will lock first.

Note: You can also use `git push`, `git push --tags` or `git push --follow-tags`, but you'll lose the benefit of automatically locking, signing, or timestamping.

Also Note: If you have just locked an existing repo with all commits already pushed, you have to use `git push --tags` to push all locks (while `gitlock push` only pushes tags if the related commit is to be pushed). So when doing `git push --tags`, make sure other branches you don't intend to push don't have any locks yet.

### Synopsis 5: verify

```
gitlock verify
gitlock verify --all
gitlock verify <commit>
gitlock verify --to-head <commit>
```

Verify the locks (including signatures and timestamps) of the current commit, or all commits from the first commit to HEAD, or the specified commit, or commits from the specified commit to HEAD.

### Synopsis 6: proof

```
gitlock proof <directory>
gitlock proof --all <directory>
gitlock proof <commit> <directory>
gitlock proof --to-head <commit> <directory>
```

Generate a proof (usually meaning a proof of copyright) of the current commit, or all commits from the first commit to HEAD, or the specified commit, or commits from the specified commit to HEAD. Then output the proof to a directory. `<directory>` must already exist.

Although people can use the `verify` subcommand to verify your repo, not all people trust GitLock. That's a problem. But luckily, people must trust the famous OpenSSL. So it's important that it can generate some proof that can be verified by OpenSSL.

In the generated directory there's a readme file. Everyone can follow the steps in it to prove your copyright.

Note that generating a proof even for a single commit may take some time, because it must traverse all previous locks to convert a later lock from diff format to full format, unless it is cached. But non-HEAD commits won't be cached.

Caution: If using `--all`, the generated proof may be very big if every commit holds a large number of files. Here's the estimated proof size in bytes: `100 * number_of_files_in_each_commit * number_of_commits`. So, take care if you have 600,000 commits with each having 50,000 files, such as the Linux Kernel (the world's largest Git repo). In these cases, don't use `--all`.

### Synopsis 7: show

```
gitlock show <object>
```

Show lock information in `<object>`. If `<object>` is a lock, it shows the lock's information. If `<object>` is a commit, then it shows information of all locks that belong to the commit. `<object>` can be any Git object, tag, or ref.

### Synopsis 8: parse

```
gitlock parse <timestamp-lock>
```

Show timestamp information, such as the timestamp time.

You can find lines like this in the output:

```
... prim: OBJECT    :signingTime
... cons: SEQUENCE
... prim: UTCTIME   :150228132728Z
```

It means the timestamp is signed on 2015-02-28 13:27:28 UTC Time.

### Synopsis 9: list

```
gitlock list
```

List all locks in chronological order.

### Synopsis 10: remove

```
gitlock remove [--last | --commit | --all]
gitlock remove <commit-or-lock>
```

Remove locks. If `--all`, it removes all locks in the repo. If `--commit`, it removes all locks in HEAD commit. If `--last`, it removes only the last lock in the `001`, `002` sequence in HEAD commit (`000` won't be removed). The default is `--commit`.

If you specify a commit or lock, then: If it's a commit or base lock, it will remove this lock (or the lock that matches this commit) and all succeeding locks in the commit chain, without affecting preceding locks. If it's a timestamp / signature lock, it will remove this lock and all succeeding locks in the in-commit chain, without affecting preceding locks.

You should be very careful in removing locks. Losing an intermediate lock will make a chain broken. There're two types of lock chains: commit chain and in-commit chain. Both are important. Particularly, don't move HEAD to an intermediate commit then `gitlock remove`.

### Synopsis 11: log

```
gitlock log
```

Show the commit logs in combination with lock names and other tag info.

### Synopsis 12: tag

```
gitlock tag <name>
gitlock tag
```

Add a simple annotated tag, or show tags (but excluding lock tags) if `<name>` is ommited. When adding a tag, it's similar to `git tag <name>` except that it's for annotated tag, so it's equivalent to `git tag -a -m "" <name>`. Using annotated tags brings the benefit of automatic pushing tags when using `gitlock push`.

This command provides an easy way to add an annotated tag with empty message, so we call it "simple annotated" tag. To have messages, you need to use `git tag`.

Configuration
=============

The configuration is stored in the `.gitlock` directory under user's home directory. It doesn't modify your repo's directory.

### Synopsis 1: config

```
gitlock config
```

Display the current config.

### Synopsis 2: tsa

```
gitlock config tsa <url>
```

Set the URL of the trusted Time Stamping Authority. The default is `http://timestamp.comodoca.com/rfc3161`.

### Synopsis 3: openssl

```
gitlock config openssl <path>
```

Set the OpenSSL path. The default is `openssl`.

On Mac OS X, the built-in OpenSSL is v0.9.8 (you can view it through `openssl version`), but the timestamp feature is only in v1.0+. So on Mac OS X, you must install a newer OpenSSL to a different directory and set this config to the installed OpenSSL file path. For how to build an install, see [https://wiki.openssl.org/index.php/Compilation_and_Installation#Mac](https://wiki.openssl.org/index.php/Compilation_and_Installation#Mac).

On Windows, because the build process is a little more complicated, you can use some pre-built binaries. See [https://wiki.openssl.org/index.php/Binaries](https://wiki.openssl.org/index.php/Binaries).

On Windows if you have Bash installed then you might already have OpenSSL. In Bash, type `openssl version` to see if it's installed and make sure the version is higher than 1.0.

### Synopsis 4: root-ca

```
gitlock config root-ca <path>
gitlock config root-ca
```

Set the location of root certificates. This is for verifying. `<path>` must be a directory containing certificate files in PEM (i.e. Base64-encoded) format. If there's no `<path>`, it will set this config to nothing.

For example, for Comodo timestamps, you can:

- On Windows 10, click start button, type `certmgr.msc` in the search box and press enter, then export the `UTN-USERFirst-Object` certificate.
- On Mac OS, open KeyChain, then export the `UTN-USERFirst-Object` certificate.
- Or download this certificate [here](https://support.comodo.com/index.php?/Default/Knowledgebase/Article/View/910/93/old-utn-userfirst-object).

Then rename the file to "`2c3e3f84.0`" (Very important. The filename must be in `xxxxxxxx.0` format).

You can also use the command `c_rehash` to generate `xxxxxxxx.0` files. For details see:

[https://www.openssl.org/docs/man1.0.2/apps/c_rehash.html](https://www.openssl.org/docs/man1.0.2/apps/c_rehash.html)

Again, in Mac OS X do not use the built-in `c_rehash` command (this uses outdated MD5 to generate a different hash that newer version can't recognize). You should use the one bundled with OpenSSL v1.0+. For example, for Comodo's `UTN-USERFirst-Object` certificate, you can type this under the `<path>` directory:

```bash
path-to-c_rehash/c_rehash .
```

The generated symlink will be "`2c3e3f84.0`".

### Synopsis 5: lock-default

```
gitlock config lock-default <value>
```

This represents the behavior when typing `gitlock` without any subcommand, or with `-m` or `commit` subcommands. Allowed values are "lock", "lock, timestamp", "lock, sign", "lock, sign, timestamp" (values containing "sign" are not implemented yet). The default is "lock".

For example, if set to "lock, timestamp", when typing `gitlock` it will automatically timestamp after locking. But normally you don't need to set to this and then lock on every commit, as every timestamp will occupy 1-4 KB of space. A more reasonable strategy is to timestamp before push (i.e. before everyone know it).

### Synopsis 6: push-default

```
gitlock config push-default <value>
```

This represents the behavior before push when typing `gitlock push`. Allowed values are "lock", "lock, timestamp", "lock, sign", "lock, sign, timestamp" (values containing "sign" are not implemented yet). The default is "lock".

For example, if set to "lock, timestamp", when typing `gitlock push` it will automatically timestamp after locking.

### Synopsis 7 (not implemented yet): private

```
gitlock config private <path>
gitlock config private
```

If you want to sign, you can set this config. `<path>` must be a directory containing a file (for now only support a single file) in PEM format. The file must contain the private key (may also contain the certificate). For how to convert a certificate to PEM format, see OpenSSL manual.

If there's no `<path>`, it will set this config to nothing.

Reset
=====

Occasionally, You may want to reset all configurations and caches, and remove all data in the `.gitlock` directory. The reason is perhaps there are configuration conflicts between this version and a previous version to prevent it working correctly. You can do this and try again, maybe it will be solved:

```bash
gitlock reset-program-data
```

Or alternatively, deleting the `.gitlock` directory should have the same effect.

Limitations
===========

Currently it doesn't support repos with history of "orphan branches". Orphan branch causes multiple roots, which is weird and rarely used. We may support it later.

Examples
========

```bash
git add .
gitlock -m 'Fix a bug'
```

This will add files to the index, then run `git commit -m 'Fix a bug'`, then run `gitlock`.

```bash
gitlock timestamp
gitlock push
```

This will timestamp and push commits including locks to the remote server.

FAQ
====

**Q: Will the timestamp request disclose my private code?**

A: No. It only sends a SHA-256 hash.

**Q: What's "secure delay"?**

A: It's an interval between timestamping time and pushing time. The purpose is to prevent others from timestamping immediately after you push. If there's no delay, then if someone uses a bot to listen to your Git address, he can modify your copyright info and timestamp at the same second of your timestamp. The timestamp granularity is 1 second, so the delay should be at least 1 second. We set it to 5 seconds.

**Q: Does the SHA-256 lock rely on any SHA-1?**

A: No. If it relies on any SHA-1 then the whole structure will be as weak as SHA-1. For details see `architecture.md`'s FAQ.

**Q: Why so many root certificates are still in SHA-1?**

A: Root certificates are special. System doesn't check root's signature. So it doesn't matter. See [this article](https://blog.qualys.com/ssllabs/2014/09/09/sha1-deprecation-what-you-need-to-know).
