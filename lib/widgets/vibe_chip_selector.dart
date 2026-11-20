// ignore: deprecated_member_use
import 'package:flutter/material.dart';

/// Reusable multi-select vibe chip selector.
class VibeChipSelector extends StatelessWidget {
  final List<String> availableVibes;
  final Set<String> selectedVibes;
  final ValueChanged<String> onVibeToggled;

  const VibeChipSelector({
    super.key,
    required this.availableVibes,
    required this.selectedVibes,
    required this.onVibeToggled,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: availableVibes.map((vibe) {
        final isSelected = selectedVibes.contains(vibe);
        return FilterChip(
          label: Text(vibe),
          selected: isSelected,
          onSelected: (_) => onVibeToggled(vibe),
          showCheckmark: false,
          selectedColor: Colors.teal.shade100,
          labelStyle: TextStyle(
            color: isSelected ? Colors.teal.shade900 : Colors.black87,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            fontSize: 13,
          ),
          side: BorderSide(
            color: isSelected ? Colors.teal : Colors.grey.shade300,
          ),
        );
      }).toList(),
    );
  }
}
