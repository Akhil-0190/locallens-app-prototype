// ignore_for_file: deprecated_member_use
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/offline_pack.dart';
import '../providers/offline_providers.dart';
import '../services/offline_model_manager.dart';

class OfflinePacksScreen extends ConsumerStatefulWidget {
  const OfflinePacksScreen({super.key});

  @override
  ConsumerState<OfflinePacksScreen> createState() => _OfflinePacksScreenState();
}

class _OfflinePacksScreenState extends ConsumerState<OfflinePacksScreen> {
  String? _errorMessage;
  ModelDownloadProgress? _gemmaProgress;
  StreamSubscription<ModelDownloadProgress>? _gemmaSub;
  bool _isBuildingLivePack = false;
  final TextEditingController _buildNeighborhoodController =
      TextEditingController(text: 'Malleshwaram');

  @override
  void dispose() {
    _gemmaSub?.cancel();
    _buildNeighborhoodController.dispose();
    super.dispose();
  }

  void _startGemmaDownload() {
    final manager = ref.read(offlineModelManagerProvider);
    _gemmaSub?.cancel();
    setState(() {
      _gemmaProgress = const ModelDownloadProgress(
        status: ModelDownloadStatus.checkingStorage,
      );
    });
    _gemmaSub = manager.downloadGemmaLiteRtModel().listen(
      (progress) {
        if (!mounted) return;
        setState(() => _gemmaProgress = progress);
        if (progress.status == ModelDownloadStatus.ready) {
          ref.invalidate(edgeDeviceSupportProvider);
          ref.invalidate(deviceStorageProvider);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Gemma 4 E2B ready on-device (${progress.backendLabel ?? "GPU/CPU"})!',
              ),
              backgroundColor: Colors.green[800],
            ),
          );
        }
      },
      onError: (Object err) {
        if (!mounted) return;
        setState(() {
          _gemmaProgress = ModelDownloadProgress(
            status: ModelDownloadStatus.error,
            errorMessage: err.toString(),
          );
        });
      },
    );
  }

  void _cancelGemmaDownload() {
    ref.read(offlineModelManagerProvider).cancelDownload();
  }

  Future<void> _handleBuildLivePack() async {
    final hood = _buildNeighborhoodController.text.trim();
    if (hood.isEmpty) return;
    setState(() {
      _isBuildingLivePack = true;
      _errorMessage = null;
    });
    try {
      final service = ref.read(offlinePackServiceProvider);
      final installed = await service.generateAndInstallLivePack(
        neighborhood: hood,
      );
      ref.invalidate(availablePacksProvider);
      ref.invalidate(downloadedPacksProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Built & installed live ${installed.neighborhood} pack (${installed.totalSpotsCount} spots, offline map tiles cached).',
            ),
            backgroundColor: Colors.green[800],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = 'Live pack build error: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isBuildingLivePack = false);
      }
    }
  }

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
    final edgeSupportAsync = ref.watch(edgeDeviceSupportProvider);
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

          // 2. Gemma 4 E2B Multimodal On-Device Edge AI Setup Card
          edgeSupportAsync.when(
            data: (support) {
              final ramGb = (support.totalRamMb / 1024.0).toStringAsFixed(1);
              final isDownloading =
                  _gemmaProgress?.status == ModelDownloadStatus.downloading ||
                      _gemmaProgress?.status ==
                          ModelDownloadStatus.checkingStorage ||
                      _gemmaProgress?.status ==
                          ModelDownloadStatus.verifyingChecksum ||
                      _gemmaProgress?.status ==
                          ModelDownloadStatus.initializingRuntime;
              final isReady = support.gemmaModelDownloaded ||
                  _gemmaProgress?.status == ModelDownloadStatus.ready;

              return Card(
                elevation: 0,
                color: support.gemmaE2bSupported
                    ? Colors.teal.shade50
                    : Colors.orange.shade50,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: support.gemmaE2bSupported
                        ? Colors.teal.shade300
                        : Colors.orange.shade300,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isReady ? Icons.verified : Icons.memory,
                            color: support.gemmaE2bSupported
                                ? Colors.teal.shade800
                                : Colors.orange.shade900,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Gemma 4 E2B Edge AI (140+ Lang Vision & Q&A)',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: support.gemmaE2bSupported
                                    ? Colors.teal.shade900
                                    : Colors.orange.shade900,
                              ),
                            ),
                          ),
                          Chip(
                            label: Text(
                              isReady
                                  ? 'Ready (${support.activeBackend != "NONE" ? support.activeBackend : support.recommendedBackend})'
                                  : support.gemmaE2bSupported
                                      ? '$ramGb GB • ${support.recommendedBackend}'
                                      : '<6 GB Guard',
                              style: const TextStyle(fontSize: 10),
                            ),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        support.gemmaE2bSupported
                            ? (isReady
                                ? 'Gemma 4 E2B LiteRT-LM is installed on-device for 100% offline camera sign/menu translation and street tips.'
                                : 'Eligible ($ramGb GB RAM). Automatically downloads over Wi-Fi or tap below for resumable setup (~2.6 GB, ${support.recommendedBackend} delegate).')
                            : 'Hardware safety guard active ($ramGb GB RAM < 6 GB minimum). Offline packs, disk map tiles, and ML Kit OCR work safely without OOM risk.',
                        style: const TextStyle(fontSize: 12),
                      ),
                      if (isDownloading && _gemmaProgress != null) ...[
                        const SizedBox(height: 10),
                        LinearProgressIndicator(
                          value: _gemmaProgress!.status ==
                                  ModelDownloadStatus.downloading
                              ? _gemmaProgress!.progressPercent
                              : null,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _gemmaProgress!.status ==
                                      ModelDownloadStatus.downloading
                                  ? 'Downloading ${_formatBytes(_gemmaProgress!.bytesDownloaded)} / ${_formatBytes(_gemmaProgress!.totalBytes)} (${(_gemmaProgress!.progressPercent * 100).toStringAsFixed(1)}%)'
                                  : _gemmaProgress!.status ==
                                          ModelDownloadStatus.verifyingChecksum
                                      ? 'Verifying checksum...'
                                      : _gemmaProgress!.status ==
                                              ModelDownloadStatus
                                                  .initializingRuntime
                                          ? 'Initializing LiteRT-LM runtime...'
                                          : 'Checking storage...',
                              style: const TextStyle(fontSize: 11),
                            ),
                            TextButton(
                              onPressed: _cancelGemmaDownload,
                              child: const Text('Pause/Cancel'),
                            ),
                          ],
                        ),
                      ] else if (_gemmaProgress?.errorMessage != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          _gemmaProgress!.errorMessage!,
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.red.shade800,
                          ),
                        ),
                      ],
                      if (support.gemmaE2bSupported &&
                          !isReady &&
                          !isDownloading) ...[
                        const SizedBox(height: 10),
                        FilledButton.icon(
                          onPressed: _startGemmaDownload,
                          icon: const Icon(Icons.download_for_offline, size: 18),
                          label: const Text('Download Gemma 4 E2B (.litertlm)'),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 12),

          // 3. Build Live Offline Neighborhood Pack from Firestore + OSM Tiles
          Card(
            elevation: 0,
            color: Colors.blueGrey.shade50,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.blueGrey.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Build Live Offline Pack (Spots + Routes + Disk Map Tiles)',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _buildNeighborhoodController,
                          decoration: const InputDecoration(
                            hintText: 'Neighborhood (e.g., Malleshwaram, Indiranagar)',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton.tonalIcon(
                        onPressed:
                            _isBuildingLivePack ? null : _handleBuildLivePack,
                        icon: _isBuildingLivePack
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.cloud_download, size: 18),
                        label: const Text('Build & Save'),
                      ),
                    ],
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
                                      'Pack Version: v${pack.version} • ${_formatBytes(pack.downloadSizeBytes)}',
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
