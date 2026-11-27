/// Typed failure taxonomy surfaced across services and Riverpod providers
/// so UI screens can render honest retry, auth, or offline empty states
/// instead of falling back to hardcoded mock data.
enum AppFailureKind {
  networkUnavailable,
  authenticationRequired,
  offlineModelUnavailable,
  backendError,
  notFound,
  paymentFailed,
}

class AppFailure implements Exception {
  final AppFailureKind kind;
  final String message;
  final String? code;
  final Object? cause;

  const AppFailure(
    this.kind,
    this.message, {
    this.code,
    this.cause,
  });

  factory AppFailure.network([
    String message = 'Network connection unavailable. Check connectivity or use Offline Packs.',
    Object? cause,
  ]) =>
      AppFailure(AppFailureKind.networkUnavailable, message, cause: cause);

  factory AppFailure.auth([
    String message = 'Sign in required to perform this action.',
    Object? cause,
  ]) =>
      AppFailure(AppFailureKind.authenticationRequired, message, cause: cause);

  factory AppFailure.backend(
    String message, {
    String? code,
    Object? cause,
  }) =>
      AppFailure(AppFailureKind.backendError, message, code: code, cause: cause);

  factory AppFailure.notFound([
    String message = 'No live records available yet.',
  ]) =>
      AppFailure(AppFailureKind.notFound, message);

  @override
  String toString() => message;
}
