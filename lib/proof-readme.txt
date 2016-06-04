How to Verify
=============

"list.txt" lists all commits in order (first on top, last on bottom) with their
SHA-256 locks.

Make sure you have OpenSSL 1.0+ installed on your computer. If you're not
certain of the version, type "openssl version" to find it. On Linux it's already
built-in. On Windows, it's already installed when you installed Git. But on Mac
OS, the built-in version is 0.9.8, so you have to compile and install 1.0+:

https://wiki.openssl.org/index.php/Compilation_and_Installation

In the following text, we use the command name "openssl" for simplification. You
may need to replace it with "your-path/openssl".

Verify a Timestamp
------------------

First, we'll need to find the timestamp. In "list.txt", a timestamp has a
3-digit mark greater than "000". Find it, and find the corresponding .txt file.
The file is like this:

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
timestamps

parent sha256-...

base64-...

nonce ...
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

The actual "base64" field is very long (usually 3K characters). You can use
whatever method to decode the Base64 string (excluding the "base64-" prefix) to
binary format and save it to a file named "timestamp.tsr". One method is to type
this in Node.js REPL:

fs.writeFileSync("your-path/timestamp.tsr", new Buffer("your-base64-string",
"base64"))

Then, we'll need to find the time in the timestamp. Use this command:

openssl asn1parse -inform DER -in <timestamp>

You can find lines like this in the output:

... prim: OBJECT    :signingTime
... cons: SEQUENCE
... prim: UTCTIME   :150228132728Z

It means it's signed on 2015-02-28 13:27:28 UTC Time.

Finally, we verify the timestamp with the data file. The data's 3-digit mark is
less than the timestamp's by 1. If timestamp is to "001" then data is to "000".
Find the corresponding .txt data file. (Note that "data" here can also be a
timestamp, if you have "002" timestamp then the "001" timestamp is treated as
data when you verify "002". It's called the timestamp chain. The common use is
to extend the expiration date, because most timestamps expire in 5-10 years.)

You'll need to specify a self-signed root certificate it should trust:

openssl ts -verify -in <timestamp> -data <data> -CAfile <root-cert>

The root certificate must be in PEM (i.e. Base64-encoded) format. You can
get it by exporting it. On Windows, type "certlm". On Mac OS, use KeyChain. For
example, Comodo uses this root "UTN-USERFirst-Object". You can also download it
at:

https://support.comodo.com/index.php?/Default/Knowledgebase/Article/View/910/93/
old-utn-userfirst-object

Which root certificate does the timestamp use? Analyse the parsed timestamp and
you'll know.

You may argue that many root certificates are using SHA-1! Please review this
article to find out why it doesn't matter if a root certificate is in SHA-1:

https://blog.qualys.com/ssllabs/2014/09/09/sha1-deprecation-what-you-need-to-
know

Verify Files
------------

You just need to find the "000" item and then find the corresponding .txt file.
Then compare the hash values with the raw files. That's very easy. I think you
already know it.
