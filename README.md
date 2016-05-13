GitLock
=======

Add a SHA-256 wrapper to increase the security of Git. It can also protect your copyright by adding timestamps from trusted Time Stamping Authority.

It uses tags to store these info, so it's fully compatible with the current Git. For details see "architecture.md".

Synopsis 1:

```
gitlock
```

If there're files to commit, it will commit with an empty message and lock. If there's nothing to commit, it will just lock. Note that on first time running it may take some time because it will lock all history commits.

Synopsis 2:

```
gitlock ...
```

Equivalent to `git commit ... && gitlock`. The lock message is the same as the commit message.

Synopsis 3:

```
gitlock sign
```

Sign the lock. But if you just want to prove your copyright, you really don't need to sign. Providing  your identity (name, birthday, nationality, passport number, email, etc.) in a file in your repo and then timestamping is enough.

If it hasn't been locked, it will lock first.

Synopsis 4:

```
gitlock timestamp
```

Add a trusted timestamp to the lock. If it hasn't been locked, it will lock first.

Synopsis 5:

```
gitlock verify
gitlock verify --all
```

Verify the current lock or all locks, including the signatures and timestamps.

Synopsis 6:

```
gitlock proof [<directory>]
gitlock proof --all [<directory>]
```

Generate a proof (usually a proof of copyright) of the current lock or all locks, and output the proof to a directory. If `<directory>` is omitted, it will output to the working directory.

Although people can use the `verify` subcommand to verify your repo, not all people trust GitLock. That's a problem. But luckily, people must trust the famous OpenSSL. So it's important that it can generate some proof that can be verified by OpenSSL.

In the generated directory there's a readme file. Everyone can follow the steps in it to prove your copyright.

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

For example, if set to "lock, timestamp", when typing `gitlock` it will automatically timestamp after locking.

Synopsis 5:

```
gitlock config private <pem-file>
```

If you want to sign, you can set this config. `<pem-file>` file must contain the private key (may also contain the certificate). For how to convert a certificate to PEM format, see OpenSSL manual.

Examples
========

```bash
gitlock -m 'Fix a bug'
```

This will first run `git commit -m 'Fix a bug'`, then run `gitlock`.
