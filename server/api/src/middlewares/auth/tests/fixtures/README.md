# Local authentication test keys

This disposable RSA key pair was generated for offline regression tests. It has
never been registered with Firebase or any service. The private key is public
test data, not a credential. Do not use either key in a deployed environment.

The tests seed an in-memory certificate cache with the public key and sign
short-lived tokens for the fictitious `rush-auth-test-project` project.
