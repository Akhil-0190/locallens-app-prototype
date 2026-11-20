import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/monetization.dart';
import '../providers/monetization_providers.dart';

/// Screen presenting Partner Merchant Subscriptions tailored for
/// local accommodation providers: Hotels, Homestays, and Hostels.
/// All inquiries are saved strictly as local drafts because backend self-service
/// callable is pending Developer A deployment.
class PartnerSubscriptionScreen extends ConsumerStatefulWidget {
  const PartnerSubscriptionScreen({super.key});

  @override
  ConsumerState<PartnerSubscriptionScreen> createState() =>
      _PartnerSubscriptionScreenState();
}

class _PartnerSubscriptionScreenState
    extends ConsumerState<PartnerSubscriptionScreen> {
  final TextEditingController _businessNameController = TextEditingController();
  final TextEditingController _neighborhoodController =
      TextEditingController(text: 'Malleshwaram');
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _perkController = TextEditingController();

  String _selectedPropertyType = 'HOMESTAY';
  String _selectedPlanTier = 'VERIFIED_PARTNER';
  bool _draftSaved = false;

  final List<String> _propertyTypes = ['HOTEL', 'HOMESTAY', 'HOSTEL'];

  @override
  void dispose() {
    _businessNameController.dispose();
    _neighborhoodController.dispose();
    _emailController.dispose();
    _perkController.dispose();
    super.dispose();
  }

  void _handleSaveInquiry() {
    if (_businessNameController.text.trim().isEmpty ||
        _emailController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter business name and contact email.')),
      );
      return;
    }

    final draft = LocalPartnerInquiryDraft(
      businessName: _businessNameController.text.trim(),
      propertyType: _selectedPropertyType,
      neighborhood: _neighborhoodController.text.trim(),
      contactEmail: _emailController.text.trim(),
      proposedPerk: _perkController.text.trim().isNotEmpty
          ? _perkController.text.trim()
          : '10% discount on dining for route pass holders',
      selectedPlanTier: _selectedPlanTier,
      createdAt: DateTime.now(),
    );

    ref.read(monetizationNotifierProvider.notifier).savePartnerInquiryDraft(draft);

    setState(() {
      _draftSaved = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Partner Subscriptions'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Mandatory Honest Disclosure Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Colors.amber.shade900, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '[Partner Registration: Local Draft Saved - Backend Submission Pending Developer A]\n'
                      'Merchant partner self-registration infrastructure is pending backend deployment. '
                      'Inquiries drafted here are saved locally and will not directly write to Firestore or activate a live subscription.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.amber.shade900,
                        height: 1.3,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            const Text(
              'Hospitality Partner Tiers',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              'Designed for Hotels, Homestays, and Hostels welcoming neighborhood walking explorers.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 12),

            // Tier 1: Community Free
            _buildTierCard(
              title: 'Community Free',
              tierKey: 'COMMUNITY_FREE',
              benefits: [
                'Public spot listing on neighborhood map',
                'Community traveler reviews and tips',
                'Standard search placement',
              ],
            ),
            const SizedBox(height: 10),

            // Tier 2: Verified Partner
            _buildTierCard(
              title: 'Verified Partner',
              tierKey: 'VERIFIED_PARTNER',
              isRecommended: true,
              benefits: [
                'Verified Hospitality Partner badge on spot card',
                'Included in Walking Route Pass discounts',
                'Turn-by-turn audio walking co-pilot mention',
                'Priority ranking in neighborhood itineraries',
              ],
            ),
            const SizedBox(height: 10),

            // Tier 3: Featured Heritage
            _buildTierCard(
              title: 'Featured Heritage',
              tierKey: 'FEATURED_HERITAGE',
              benefits: [
                'Exclusive Featured Anchor Partner status',
                'Dedicated audio story spotlight during walks',
                'Top placement on offline packs and Pocket Guide',
                'Quarterly visitor footfall analytics report',
              ],
            ),
            const SizedBox(height: 24),

            // Registration Form
            const Text(
              'Register Partner Interest',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            if (_draftSaved) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: Column(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green.shade700, size: 36),
                    const SizedBox(height: 8),
                    const Text(
                      'Partner Inquiry Draft Saved!',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.green),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Your inquiry has been stored locally. Once Developer A enables merchant self-service onboarding, our team will review your property perks.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Colors.black87),
                    ),
                  ],
                ),
              ),
            ] else ...[
              TextField(
                controller: _businessNameController,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Property / Business Name',
                  hintText: 'e.g. Malleshwaram Heritage Homestay',
                ),
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _selectedPropertyType,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Property Category',
                      ),
                      items: _propertyTypes
                          .map((t) => DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 13))))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedPropertyType = val);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _neighborhoodController,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Neighborhood',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Contact Email',
                  hintText: 'partner@example.com',
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: _perkController,
                maxLines: 2,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Proposed Traveler Perk',
                  hintText: 'e.g. 10% discount on dining or free South Indian filter coffee for route pass holders',
                ),
              ),
              const SizedBox(height: 18),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.bookmark_added_outlined),
                  label: const Text('Save Partner Inquiry Draft (Local Only)'),
                  onPressed: _handleSaveInquiry,
                ),
              ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildTierCard({
    required String title,
    required String tierKey,
    required List<String> benefits,
    bool isRecommended = false,
  }) {
    final isSelected = _selectedPlanTier == tierKey;

    return InkWell(
      onTap: () => setState(() => _selectedPlanTier = tierKey),
      borderRadius: BorderRadius.circular(10),
      child: Card(
        elevation: isSelected ? 2 : 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(
            color: isSelected ? Colors.teal : Colors.grey.shade300,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  if (isRecommended)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.teal,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'POPULAR',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              // Pricing Pending Label
              const Text(
                'Pricing: Pending Commercial Confirmation',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.blueGrey),
              ),
              const Divider(height: 16),
              ...benefits.map(
                (b) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.check, size: 14, color: Colors.teal),
                      const SizedBox(width: 6),
                      Expanded(child: Text(b, style: const TextStyle(fontSize: 12))),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
