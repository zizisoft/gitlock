GitLock
=======

Add a SHA-256 wrapper to increase the security of Git. It can also protect your copyright by adding timestamps from trusted Time Stamping Authority.

In essence, it just adds tags. It doesn't modify your repo's internals, so it's safe - Your history and commit IDs will remain unchanged. It's compatible with Git (1.8.3 or higher), GitHub, and BitBucket. For details see "architecture.md".

Synopsis 1:

```
gitlock
gitlock -m <commit-message>
gitlock commit
gitlock commit ...
```

Lock. If there're files in the index but not committed, it will commit before locking.

It locks every commit between the current branch (the HEAD commit) and the very first commit of the repo.

If `gitlock` without any arguments, when committing the commit message will be empty.

If `gitlock commit`, when committing it will show an editor, like `git commit`.

If `gitlock commit ...`, it's equivalent to `git commit ...` then `gitlock`.

`gitlock -m <commit-message>` is a shorthand for `gitlock commit -m <commit-message>`.

Note that on the first time running it may take some minutes, because it will lock all history commits.

After locked, it can automatically sign or timestamp based on your configuration.

Synopsis 2:

```
gitlock sign
```

Sign the lock. But if you just want to prove your copyright, you really don't need to sign. Providing  your identity (name, birthday, nationality, passport number, email, etc.) in a file in your repo and then timestamping is enough.

If it hasn't been locked, it will lock first.

Synopsis 3:

```
gitlock timestamp
```

Add a trusted timestamp to the lock. If it hasn't been locked, it will lock first.

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
```

Verify the current lock or all locks from HEAD to the first commit, including the signatures and timestamps.

Synopsis 6:

```
gitlock proof [<directory>]
gitlock proof --all [<directory>]
```

Generate a proof (usually a proof of copyright) of the current lock or all locks from HEAD to the first commit, and output the proof to a directory. If `<directory>` is omitted, it will output to the working directory.

Although people can use the `verify` subcommand to verify your repo, not all people trust GitLock. That's a problem. But luckily, people must trust the famous OpenSSL. So it's important that it can generate some proof that can be verified by OpenSSL.

In the generated directory there's a readme file. Everyone can follow the steps in it to prove your copyright.

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
```

Remove locks. If `--all`, it removes all locks in the repo. If `--commit`, it removes all locks in HEAD commit. If `--last`, it removes only the last lock in the `000`, `001`, `002` sequence in HEAD commit. The default is `--commit`.

You should be very careful in removing locks. Losing an intermediate lock will make a chain broken. There're two types of lock chains: commit chain and in-commit chain. Both are important.

Configuration
=============

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
gitlock config lock-default <value>
```

This represents the behavior when typing `gitlock` without and subcommand. Allowed values are "lock", "lock, timestamp", "lock, sign", "lock, sign, timestamp". The default is "lock".

For example, if set to "lock, timestamp", when typing `gitlock` it will automatically timestamp after locking. But normally you don't need to use this and timestamp on every commit, as every timestamp will occupy 1-4 KB of space. A more reasonable strategy is to timestamp before push (i.e. before everyone know it).

Synopsis 4:

```
gitlock config push-default <value>
```

This represents the behavior when typing `gitlock push`. Allowed values are "lock", "lock, timestamp", "lock, sign", "lock, sign, timestamp". The default is "lock".

For example, if set to "lock, timestamp", when typing `gitlock` it will automatically timestamp after locking. But normally you don't need to use this and timestamp on every commit, as every timestamp will occupy 1-4 KB of space. A more reasonable strategy is to timestamp before push (i.e. before everyone know it).

Synopsis 5:

```
gitlock config private <pem-file>
gitlock config private
```

If you want to sign, you can set this config. `<pem-file>` file must contain the private key (may also contain the certificate). For how to convert a certificate to PEM format, see OpenSSL manual.

If there's no `<pem-file>`, it will set this config to nothing.

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
