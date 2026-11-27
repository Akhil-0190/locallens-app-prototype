import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../models/monetization.dart';
import '../providers/monetization_providers.dart';

/// Modal sheet for purchasing and activating neighborhood Route Passes via Razorpay.
/// 20% of confirmed pass revenue is shared pro-rata with verified local contributors.
class PassCheckoutSheet extends ConsumerStatefulWidget {
  final PassTier tier;
  final String neighborhood;
  final List<String>? accessibleRouteIds;

  const PassCheckoutSheet({
    super.key,
    required this.tier,
    this.neighborhood = 'Malleshwaram',
    this.accessibleRouteIds,
  });

  @override
  ConsumerState<PassCheckoutSheet> createState() => _PassCheckoutSheetState();
}

class _PassCheckoutSheetState extends ConsumerState<PassCheckoutSheet> {
  Razorpay? _razorpay;
  String? _activeRazorpayPassId;

  int get _tierPriceInr {
    switch (widget.tier) {
      case PassTier.singleRoute:
        return 99;
      case PassTier.neighborhoodAllAccess:
        return 299;
      case PassTier.annualExplorer:
        return 999;
    }
  }

  @override
  void initState() {
    super.initState();
    try {
      _razorpay = Razorpay();
      _razorpay!.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onRazorpaySuccess);
      _razorpay!.on(Razorpay.EVENT_PAYMENT_ERROR, _onRazorpayError);
      _razorpay!.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
    } catch (_) {}
  }

  void _onRazorpaySuccess(PaymentSuccessResponse response) {
    final passId = _activeRazorpayPassId ??
        ref.read(monetizationNotifierProvider).pendingPass?.passId;
    if (passId == null) return;
    ref.read(monetizationNotifierProvider.notifier).confirmPassPayment(
          passId: passId,
          providerPaymentId: response.paymentId,
          providerSignature: response.signature,
        );
  }

  void _onRazorpayError(PaymentFailureResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Razorpay pass payment failed: ${response.message ?? 'Error code ${response.code}'}',
        ),
        backgroundColor: Colors.red.shade700,
      ),
    );
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Redirecting to wallet: ${response.walletName}')),
    );
  }

  void _openRazorpayCheckout(RoutePass pass, PaymentIntent intent) {
    final keyId = intent.razorpayKeyId;
    final orderId = intent.orderId ?? intent.gatewayReference;
    if (_razorpay == null || keyId == null || keyId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Razorpay key not returned by backend pass order intent.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    _activeRazorpayPassId = pass.passId;
    final priceInr = pass.pricePaidInr > 0 ? pass.pricePaidInr : _tierPriceInr.toDouble();
    final options = <String, dynamic>{
      'key': keyId,
      'amount': (priceInr * 100).round(),
      'currency': 'INR',
      'order_id': orderId,
      'name': 'LocalLens',
      'description': '${widget.tier.displayName} — ${widget.neighborhood}',
      'theme': {'color': '#0F766E'},
    };
    _razorpay!.open(options);
  }

  @override
  void dispose() {
    _razorpay?.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final uiState = ref.watch(monetizationNotifierProvider);
    final notifier = ref.read(monetizationNotifierProvider.notifier);
    final tier = widget.tier;
    final neighborhood = widget.neighborhood;
    final accessibleRouteIds = widget.accessibleRouteIds;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    tier.displayName,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () {
                    notifier.clearMessages();
                    Navigator.of(context).pop();
                  },
                ),
              ],
            ),
            Text(
              'Neighborhood: $neighborhood • ${tier.durationLabel}',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
            ),
            const SizedBox(height: 12),

            // Mandatory Sandbox Mode Disclosure Badge
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.deepPurple.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.deepPurple.shade200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, color: Colors.deepPurple.shade700, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Instant Route Pass Activation\n'
                      'Unlock offline audio walking navigation, offline map tiles, and verified merchant perks.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.deepPurple.shade900,
                        height: 1.3,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Live Razorpay Pricing Label
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.blueGrey.shade50,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.blueGrey.shade200),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 16, color: Colors.blueGrey),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '₹$_tierPriceInr INR via Razorpay • 20% Revenue Shared with Local Contributors',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.blueGrey,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Perks List
            const Text('Included Perks:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 8),
            _buildPerkRow(Icons.headphones, 'Turn-by-turn Audio Walking Co-pilot'),
            _buildPerkRow(Icons.offline_pin_outlined, 'Offline Spot Cards & Audio Pack (Map tile pre-caching pending)'),
            _buildPerkRow(Icons.local_offer_outlined, 'Partner Merchant Discounts at Participating Stalls'),
            const SizedBox(height: 16),

            // Error display
            if (uiState.errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade700, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        uiState.errorMessage!,
                        style: TextStyle(fontSize: 12, color: Colors.red.shade900),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Success display (Pass ACTIVE)
            if (uiState.lastActivatedPass != null && uiState.lastActivatedPass!.status == PassStatus.active) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: Column(
                  children: [
                    Icon(Icons.verified, color: Colors.green.shade700, size: 40),
                    const SizedBox(height: 8),
                    const Text(
                      'Route Pass Activated!',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Pass ID: ${uiState.lastActivatedPass!.passId}',
                      style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Valid until: ${uiState.lastActivatedPass!.validUntil.toLocal().toString().split('.').first}',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    notifier.clearMessages();
                    Navigator.of(context).pop();
                  },
                  child: const Text('Done'),
                ),
              ),
            ]
            // Step 2: Pass Initiated (PENDING) -> Confirm Payment
            else if (uiState.pendingPaymentIntent != null && uiState.pendingPass != null) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Pass Status:', style: TextStyle(fontSize: 12)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            uiState.pendingPass!.status.value,
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber.shade900),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Gateway Reference:', style: TextStyle(fontSize: 12)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            uiState.pendingPaymentIntent!.gatewayReference,
                            style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.end,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              if (uiState.isLoading)
                const Center(child: CircularProgressIndicator())
              else ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.teal.shade700,
                      foregroundColor: Colors.white,
                    ),
                    icon: const Icon(Icons.check_circle_outline),
                    label: Text(
                      uiState.pendingPaymentIntent!.mode == PaymentMode.live &&
                              uiState.pendingPaymentIntent!.razorpayKeyId != null
                          ? 'Pay ₹$_tierPriceInr via Razorpay & Activate Pass'
                          : 'Confirm & Activate Pass',
                    ),
                    onPressed: () {
                      final intent = uiState.pendingPaymentIntent!;
                      final pass = uiState.pendingPass!;
                      if (intent.mode == PaymentMode.live &&
                          intent.razorpayKeyId != null &&
                          intent.razorpayKeyId!.isNotEmpty) {
                        _openRazorpayCheckout(pass, intent);
                      } else {
                        notifier.confirmPassPayment(passId: pass.passId);
                      }
                    },
                  ),
                ),
              ],
            ]
            // Step 1: Initiate Purchase
            else ...[
              if (uiState.isLoading)
                const Center(child: CircularProgressIndicator())
              else
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                    ),
                    icon: const Icon(Icons.shopping_bag_outlined),
                    label: const Text('Activate Pass Now'),
                    onPressed: () {
                      notifier.purchaseRoutePass(
                        tier: tier,
                        neighborhood: neighborhood,
                        accessibleRouteIds: accessibleRouteIds,
                      );
                    },
                  ),
                ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  static Widget _buildPerkRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.deepPurple),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
