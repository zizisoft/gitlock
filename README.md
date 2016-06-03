GitLock
=======

Add a SHA-256 wrapper to increase the security of Git. It can also protect your copyright by adding timestamps from trusted Time Stamping Authority.

In essence, it just adds tags. It doesn't modify your repo's internals, so it's safe - Your history and commit IDs will remain unchanged. It's compatible with Git (1.8.3 or higher), GitHub, and BitBucket. For details see "architecture.md".

There're 3 types of locks: base lock, timestamp lock, signature lock.

Synopsis 1:

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

Synopsis 2:

```
gitlock sign
```

Sign the current lock. But if you just want to prove your copyright, you really don't need to sign. Providing  your name and email in a file (like `package.json`) in your repo and then timestamping is enough. If you're still not confident, provide more information like your birthday, nationality and passport number in a file (like `author-info.txt`).

If it hasn't been locked, it will lock first.

Synopsis 3:

```
gitlock timestamp
```

Add a trusted timestamp to the current lock. If it hasn't been locked, it will lock first.

You don't need to timestamp every lock / commit, as the timestamp can prove that every preceding lock / commit happened before the time.

IMPORTANT: If your repo is public, you should timestamp before push. Timestamping after push is weak.

Synopsis 4:

```
gitlock push
```

Push commits and their tags (including locks). Before push, it can automatically sign or timestamp based on your configuration.

If it hasn't been locked, it will lock first.

Note: You can also use `git push`, `git push --tags` or `git push --follow-tags`, but you'll lose the benefit of automatically locking, signing, or timestamping.

Also Note: If you have just locked an existing repo with all commits already pushed, you have to use `git push --tags` to push all locks (while `gitlock push` only pushes tags if the related commit is to be pushed). So when doing `git push --tags`, make sure other branches you don't intend to push don't have any locks yet.

Synopsis 5:

```
gitlock verify
gitlock verify --all
gitlock verify <commit>
```

Verify the locks (including signatures and timestamps) of the current commit, or all commits from HEAD to first, or the specified commit.

Synopsis 6:

```
gitlock proof <directory>
gitlock proof --all <directory>
gitlock proof <commit> <directory>
```

Generate a proof (usually meaning a proof of copyright) of the current commit, or all commits from HEAD to first, or the specified commit. Then output the proof to a directory. `<directory>` must already exist.

Although people can use the `verify` subcommand to verify your repo, not all people trust GitLock. That's a problem. But luckily, people must trust the famous OpenSSL. So it's important that it can generate some proof that can be verified by OpenSSL.

In the generated directory there's a readme file. Everyone can follow the steps in it to prove your copyright.

Note that generating a proof even for a single commit may take some time, because it must traverse all previous locks to convert a later lock from diff format to full format, unless it is cached. But non-HEAD commits won't be cached.

Caution: If using `--all`, the generated proof may be very big if every commit holds a large number of files. Here's the estimated proof size in bytes: `100 * number_of_files_in_each_commit * number_of_commits`. So, take care if you have 600,000 commits with each having 50,000 files, such as the Linux Kernel (the world's largest Git repo). In these cases, don't use `--all`.

Synopsis 7:

```
gitlock show <object>
```

Show lock information in `<object>`. If `<object>` is a lock, it shows the lock's information. If `<object>` is a commit, then it shows information of all locks that belong to the commit. `<object>` can be any Git object, tag, or ref.

Synopsis 8:

```
gitlock list
```

List all locks in chronological order.

Synopsis 9:

```
gitlock log
```

Show the commit logs in combination with lock names and other tag info.

Synopsis 10:

```
gitlock remove [--last | --commit | --all]
gitlock remove <commit-or-lock>
```

Remove locks. If `--all`, it removes all locks in the repo. If `--commit`, it removes all locks in HEAD commit. If `--last`, it removes only the last lock in the `001`, `002` sequence in HEAD commit (`000` won't be removed). The default is `--commit`.

If you specify a commit or lock, then: If it's a commit or base lock, it will remove this lock (or the lock that matches this commit) and all succeeding locks in the commit chain, without affecting preceding locks. If it's a timestamp / signature lock, it will remove this lock and all succeeding locks in the in-commit chain, without affecting preceding locks.

You should be very careful in removing locks. Losing an intermediate lock will make a chain broken. There're two types of lock chains: commit chain and in-commit chain. Both are important. Particularly, don't move HEAD to an intermediate commit then `gitlock remove`.

Configuration
=============

The configuration is stored in the `.gitlock` directory under user's home directory. It doesn't modify your repo's directory.

Synopsis 1:

```
gitlock config
```

Display the current config.

Synopsis 2:

```
gitlock config tsa <url>
```

Set the URL of the trusted Time Stamping Authority. The default is `http://timestamp.comodoca.com/rfc3161`.

Synopsis 3:

```
gitlock config openssl <path>
```

Set the OpenSSL path. The default is `openssl`.

On Mac OS X, the built-in OpenSSL is v0.9.8 (you can view it through `openssl version`), but the timestamp feature is only in v1.0+. So on Mac OS X, you must install a newer OpenSSL to a different directory and set this config to the installed OpenSSL file path. For how to build an install, see [https://wiki.openssl.org/index.php/Compilation_and_Installation#Mac](https://wiki.openssl.org/index.php/Compilation_and_Installation#Mac).

On Windows, because the build process is a little more complicated, you can use some pre-built binaries. See [https://wiki.openssl.org/index.php/Binaries](https://wiki.openssl.org/index.php/Binaries).

On Windows if you have Bash installed then you might already have OpenSSL. In Bash, type `openssl version` to see if it's installed and make sure the version is higher than 1.0.

Synopsis 4:

```
gitlock config root-ca <path>
gitlock config root-ca
```

Set the location of root certificates. This is for verifying. `<path>` must be a directory containing files in PEM format. On Linux you can simply set it to `/etc/ssl/certs`, but On Windows and Mac OS you must create your own directory.

If there's no `<path>`, it will set this config to nothing.

Synopsis 5:

```
gitlock config lock-default <value>
```

This represents the behavior when typing `gitlock` without and subcommand. Allowed values are "lock", "lock, timestamp", "lock, sign", "lock, sign, timestamp". The default is "lock".

For example, if set to "lock, timestamp", when typing `gitlock` it will automatically timestamp after locking. But normally you don't need to set to this and then lock on every commit, as every timestamp will occupy 1-4 KB of space. A more reasonable strategy is to timestamp before push (i.e. before everyone know it).

Synopsis 6:

```
gitlock config push-default <value>
```

This represents the behavior before push when typing `gitlock push`. Allowed values are "lock", "lock, timestamp", "lock, sign", "lock, sign, timestamp". The default is "lock".

For example, if set to "lock, timestamp", when typing `gitlock push` it will automatically timestamp after locking.

Synopsis 7:

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
