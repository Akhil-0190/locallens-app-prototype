import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../models/monetization.dart';
import '../providers/monetization_providers.dart';

/// Modal sheet for sending micro-tips to local community contributors via Razorpay UPI / Cards.
class TippingModalSheet extends ConsumerStatefulWidget {
  final String recipientUserId;
  final String recipientName;
  final String spotId;
  final String spotName;

  const TippingModalSheet({
    super.key,
    required this.recipientUserId,
    required this.recipientName,
    required this.spotId,
    required this.spotName,
  });

  @override
  ConsumerState<TippingModalSheet> createState() => _TippingModalSheetState();
}

class _TippingModalSheetState extends ConsumerState<TippingModalSheet> {
  double _selectedAmount = 100.0;
  final TextEditingController _customAmountController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();
  bool _isCustomAmount = false;
  Razorpay? _razorpay;
  String? _activeRazorpayTipId;

  final List<double> _presetAmounts = [50.0, 100.0, 200.0];

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
    final tipId = _activeRazorpayTipId ??
        ref.read(monetizationNotifierProvider).pendingTip?.tipId;
    if (tipId == null) return;
    ref.read(monetizationNotifierProvider.notifier).settleTip(
          tipId: tipId,
          providerPaymentId: response.paymentId,
          providerSignature: response.signature,
        );
  }

  void _onRazorpayError(PaymentFailureResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Razorpay payment cancelled or failed: ${response.message ?? 'Error code ${response.code}'}',
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

  void _openRazorpayCheckout(ContributorTip tip, PaymentIntent intent) {
    final keyId = intent.razorpayKeyId;
    final orderId = intent.orderId ?? intent.gatewayReference;
    if (_razorpay == null || keyId == null || keyId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Razorpay key not returned by backend order intent.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    _activeRazorpayTipId = tip.tipId;
    final options = <String, dynamic>{
      'key': keyId,
      'amount': (tip.amountInr * 100).round(),
      'currency': 'INR',
      'order_id': orderId,
      'name': 'LocalLens',
      'description': 'Micro-tip for ${widget.recipientName} (${widget.spotName})',
      'theme': {'color': '#0F766E'},
    };
    _razorpay!.open(options);
  }

  @override
  void dispose() {
    _razorpay?.clear();
    _customAmountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  double get _currentAmount {
    if (_isCustomAmount) {
      return double.tryParse(_customAmountController.text.trim()) ?? 0.0;
    }
    return _selectedAmount;
  }

  @override
  Widget build(BuildContext context) {
    final uiState = ref.watch(monetizationNotifierProvider);
    final notifier = ref.read(monetizationNotifierProvider.notifier);

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
                    'Tip ${widget.recipientName}',
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
              'For curating ${widget.spotName}',
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
                      'Direct Digital Tipping via Razorpay (UPI / Cards)\n'
                      '95% goes directly to the local resident who curated this spot (5% platform rail fee, min ₹5).',
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

            // Success display
            if (uiState.successMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: Column(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green.shade700, size: 40),
                    const SizedBox(height: 8),
                    Text(
                      uiState.successMessage!,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Colors.green.shade900, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Ref: ${uiState.lastSettledTip?.paymentGatewayReference ?? "sandbox_sim_settled"}',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
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
            // Step 2: Payment Intent Created -> Simulate Settlement
            else if (uiState.pendingPaymentIntent != null && uiState.pendingTip != null) ...[
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
                        const Text('Transaction Reference:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        Text(
                          uiState.pendingPaymentIntent!.gatewayReference,
                          style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                        ),
                      ],
                    ),
                    const Divider(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Amount:', style: TextStyle(fontSize: 13)),
                        Text('₹${uiState.pendingTip!.amountInr.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Platform Fee:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text('₹${uiState.pendingTip!.platformFeeInr.toStringAsFixed(0)}', style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Net Contributor Credit:', style: TextStyle(fontSize: 12, color: Colors.green)),
                        Text('₹${uiState.pendingTip!.contributorNetInr.toStringAsFixed(0)}', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
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
                    icon: const Icon(Icons.payment),
                    label: Text(
                      uiState.pendingPaymentIntent!.mode == PaymentMode.live &&
                              uiState.pendingPaymentIntent!.razorpayKeyId != null
                          ? 'Pay ₹${uiState.pendingTip!.amountInr.toStringAsFixed(0)} via Razorpay (UPI / Card)'
                          : 'Confirm & Send ₹${uiState.pendingTip!.amountInr.toStringAsFixed(0)}',
                    ),
                    onPressed: () {
                      final intent = uiState.pendingPaymentIntent!;
                      final tip = uiState.pendingTip!;
                      if (intent.mode == PaymentMode.live &&
                          intent.razorpayKeyId != null &&
                          intent.razorpayKeyId!.isNotEmpty) {
                        _openRazorpayCheckout(tip, intent);
                      } else {
                        notifier.settleTip(tipId: tip.tipId);
                      }
                    },
                  ),
                ),
              ],
            ]
            // Step 1: Select Amount & Initiate
            else ...[
              const Text(
                'Select Tip Amount',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  ..._presetAmounts.map((amt) {
                    final isSelected = !_isCustomAmount && _selectedAmount == amt;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text('₹${amt.toStringAsFixed(0)}'),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() {
                              _selectedAmount = amt;
                              _isCustomAmount = false;
                            });
                          }
                        },
                      ),
                    );
                  }),
                  ChoiceChip(
                    label: const Text('Custom'),
                    selected: _isCustomAmount,
                    onSelected: (selected) {
                      setState(() {
                        _isCustomAmount = selected;
                      });
                    },
                  ),
                ],
              ),
              if (_isCustomAmount) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _customAmountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Enter amount in INR',
                    prefixText: '₹ ',
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ],
              const SizedBox(height: 14),

              // Fee Note
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Minimum ₹10, maximum ₹5,000. Net credit and any nominal platform fee are calculated and verified by the backend upon initiation.',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              const Text(
                'Personal Note of Appreciation (Optional)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _noteController,
                maxLines: 2,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'e.g. Thanks for the amazing filter coffee recommendation!',
                ),
              ),
              const SizedBox(height: 20),

              if (uiState.isLoading)
                const Center(child: CircularProgressIndicator())
              else
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.send),
                    label: Text('Send Instant Tip of ₹${_currentAmount.toStringAsFixed(0)}'),
                    onPressed: _currentAmount > 0
                        ? () {
                            notifier.initiateTip(
                              recipientUserId: widget.recipientUserId,
                              spotId: widget.spotId,
                              spotName: widget.spotName,
                              amountInr: _currentAmount,
                              personalNote: _noteController.text.trim().isNotEmpty
                                  ? _noteController.text.trim()
                                  : null,
                            );
                          }
                        : null,
                  ),
                ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
