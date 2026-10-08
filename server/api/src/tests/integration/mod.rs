// Separate feature gates keep ordinary unit tests independent of running databases.
#[cfg(feature = "integration-tests")]
mod mongodb;

#[cfg(feature = "redis-integration-tests")]
mod redis;
