GitLock
=======

Add a SHA-256 wrapper to increase the security of Git. It can also protect your copyright by adding timestamps from trusted Time Stamping Authority.

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

Synopsis 4:

```
gitlock timestamp
```

Synopsis 5:

```
gitlock verify
```

Verify all locks.

Configuration
=============

Before using the command you must create a `.gitlock` directory in user's home directory and then create some configuration files.

You must add a `~/.gitlock/tsa.txt` file containing the URL of the Time Stamping Authority.

You must add a `~/.gitlock/openssl.txt` file containing the path of the OpenSSL command.

Optionally, you can add a `private.pem` file containing the private key (may also contain the certificate) that can be used to sign a lock. For how to convert a certificate to PEM format, see OpenSSL manual.

Examples
========

```bash
gitlock -m 'Fix a bug'
```

This will first run `git commit -m 'Fix a bug'`, then run `gitlock`.

`.gitlock/tsa.txt` example:

```
http://timestamp.comodoca.com/rfc3161
```

`.gitlock/openssl.txt` example:

```
/usr/local/openssl
```

`.gitlock/default-lock-behavior.txt` example:

```
lock, timestamp
```
