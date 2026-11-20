// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/offline_pack.dart';
import '../providers/offline_providers.dart';

class OfflinePacksScreen extends ConsumerStatefulWidget {
  const OfflinePacksScreen({super.key});

  @override
  ConsumerState<OfflinePacksScreen> createState() => _OfflinePacksScreenState();
}

class _OfflinePacksScreenState extends ConsumerState<OfflinePacksScreen> {
  String? _errorMessage;

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  Future<void> _handleDownload(OfflinePackManifest pack) async {
    setState(() => _errorMessage = null);
    final progressMap = ref.read(packDownloadProgressProvider.notifier);
    progressMap.update((state) => {...state, pack.packId: 0.1});

    try {
      final service = ref.read(offlinePackServiceProvider);
      await service.downloadAndIngestPack(
        pack,
        onProgress: (p) {
          progressMap.update((state) => {...state, pack.packId: p});
        },
      );

      ref.invalidate(availablePacksProvider);
      ref.invalidate(downloadedPacksProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Successfully installed ${pack.neighborhood} offline pack!',
            ),
            backgroundColor: Colors.green[800],
          ),
        );
      }
    } catch (e) {
      setState(() => _errorMessage = e.toString());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download failed: $e'),
            backgroundColor: Colors.red[800],
          ),
        );
      }
    } finally {
      progressMap.update((state) {
        final copy = Map<String, double>.from(state);
        copy.remove(pack.packId);
        return copy;
      });
    }
  }

  Future<void> _handleDelete(OfflinePackManifest pack) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete ${pack.neighborhood} Pack?'),
        content: const Text(
          'This will remove cached routes and spots belonging to this pack. '
          'Shared spots used by other downloaded packs will be preserved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red[700]),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final service = ref.read(offlinePackServiceProvider);
      await service.deletePack(pack.packId);

      ref.invalidate(availablePacksProvider);
      ref.invalidate(downloadedPacksProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${pack.neighborhood} pack removed.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error deleting pack: $e'),
            backgroundColor: Colors.red[800],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final packsAsync = ref.watch(availablePacksProvider);
    final storageAsync = ref.watch(deviceStorageProvider);
    final aiCapsAsync = ref.watch(nativeAiCapabilitiesProvider);
    final progressMap = ref.watch(packDownloadProgressProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Offline Neighborhood Packs'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(availablePacksProvider);
              ref.invalidate(deviceStorageProvider);
              ref.invalidate(nativeAiCapabilitiesProvider);
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Device Storage & Status Card
          Card(
            elevation: 0,
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.storage,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 8),
                      Text(
                        'Device Storage Available: ',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      storageAsync.when(
                        data: (bytes) => Text(
                          _formatBytes(bytes),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        loading: () => const SizedBox.shrink(),
                        error: (_, _) => const SizedBox.shrink(),
                      ),
                    ],
                  ),
                  const Divider(height: 20),
                  // Native AI Telemetry
                  aiCapsAsync.when(
                    data: (caps) {
                      return Row(
                        children: [
                          Icon(
                            caps.aicoreInstalled ? Icons.smart_toy : Icons.smart_toy_outlined,
                            size: 18,
                            color: Colors.amber[800],
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              caps.aicoreInstalled
                                  ? 'On-Device AI: AICore Active (Android ${caps.apiLevel})'
                                  : 'On-Device AI: Requires Android 14+ AICore hardware. Running unassisted mode.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey[800],
                                  ),
                            ),
                          ),
                        ],
                      );
                    },
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 2. Open Requirements Disclosures Card
          Card(
            elevation: 0,
            color: Colors.amber[50],
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.amber[300]!),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.info_outline, size: 18, color: Colors.amber[900]),
                      const SizedBox(width: 8),
                      Text(
                        'Status Disclosures',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.amber[900],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'â€¢ [Sample Offline Pack]: Malleshwaram bundle is a sample fixture while Developer A pack generator is pending.',
                    style: TextStyle(fontSize: 12, color: Colors.amber[900]),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'â€¢ [Offline Maps Status]: Walking routes, turn-by-turn steps, and spot cards are 100% offline-cached. Full offline vector map tile caching remains an open requirement pending resolution with Developers C & A.',
                    style: TextStyle(fontSize: 12, color: Colors.amber[900]),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red[300]!),
              ),
              child: Text(
                _errorMessage!,
                style: TextStyle(color: Colors.red[900], fontSize: 13),
              ),
            ),
            const SizedBox(height: 16),
          ],

          Text(
            'Available Neighborhood Packs',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),

          packsAsync.when(
            data: (packs) {
              if (packs.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('No offline packs discovered.'),
                  ),
                );
              }
              return Column(
                children: packs.map((pack) {
                  final isDownloading = progressMap.containsKey(pack.packId);
                  final progress = progressMap[pack.packId] ?? 0.0;

                  return Card(
                    margin: const EdgeInsets.symmetric(vertical: 8),
                    elevation: 1,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${pack.neighborhood}, ${pack.city}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Pack Version: v${pack.version} â€¢ ${_formatBytes(pack.downloadSizeBytes)}',
                                      style: Theme.of(context).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                              if (pack.isDownloaded)
                                Chip(
                                  avatar: const Icon(Icons.check_circle,
                                      size: 16, color: Colors.white),
                                  label: const Text('Installed'),
                                  backgroundColor: Colors.green[700],
                                  labelStyle: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  padding: EdgeInsets.zero,
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              _buildMetricChip(
                                Icons.pin_drop,
                                '${pack.totalSpotsCount} Verified Spots',
                              ),
                              const SizedBox(width: 8),
                              _buildMetricChip(
                                Icons.directions_walk,
                                '${pack.totalRoutesCount} Walking Trail',
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (isDownloading) ...[
                            LinearProgressIndicator(value: progress),
                            const SizedBox(height: 8),
                            Text(
                              'Downloading and verifying integrity (${(progress * 100).toInt()}%)...',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ] else ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (pack.isDownloaded) ...[
                                  OutlinedButton.icon(
                                    onPressed: () => _handleDelete(pack),
                                    icon: const Icon(Icons.delete_outline,
                                        size: 18),
                                    label: const Text('Remove'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.red[700],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  FilledButton.tonalIcon(
                                    onPressed: () => _handleDownload(pack),
                                    icon: const Icon(Icons.sync, size: 18),
                                    label: const Text('Re-sync / Update'),
                                  ),
                                ] else ...[
                                  FilledButton.icon(
                                    onPressed: () => _handleDownload(pack),
                                    icon: const Icon(Icons.download, size: 18),
                                    label: const Text('Download Pack'),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (err, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text('Error loading packs: $err'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.grey[700]),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(fontSize: 12, color: Colors.grey[800]),
          ),
        ],
      ),
    );
  }
}
