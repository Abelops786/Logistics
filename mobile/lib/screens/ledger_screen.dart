import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../models/trip.dart';
import '../services/api_service.dart';
import 'bilty_screen.dart';
import 'bilty_upload_screen.dart';

class LedgerScreen extends StatefulWidget {
  const LedgerScreen({super.key});
  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  final _scrollCtrl = ScrollController();
  final Map<String, GlobalKey> _itemKeys = {};
  String? _lastHighlight;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppProvider>().loadLedger();
    });
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _maybeScrollToHighlight(String? highlightId) {
    if (highlightId == null || highlightId == _lastHighlight) return;
    _lastHighlight = highlightId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final key = _itemKeys[highlightId];
      if (key?.currentContext != null) {
        Scrollable.ensureVisible(
          key!.currentContext!,
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeInOut,
          alignment: 0.2,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        title: const Text('My Ledger', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => context.read<AppProvider>().loadLedger()),
        ],
      ),
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          final summary = provider.ledgerSummary;
          final trips = provider.trips;
          _maybeScrollToHighlight(provider.highlightTripId);
          return RefreshIndicator(
            onRefresh: provider.loadLedger,
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.all(16),
              itemCount: trips.isEmpty ? 3 : trips.length + 2,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return summary != null
                      ? _buildSummaryCards(summary)
                      : const SizedBox.shrink();
                }
                if (index == 1) {
                  return const Padding(
                    padding: EdgeInsets.only(top: 20, bottom: 12),
                    child: Text('Trip History',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  );
                }
                if (trips.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(40),
                    alignment: Alignment.center,
                    child: Text('No trips yet',
                        style: TextStyle(color: Colors.grey.shade400)),
                  );
                }
                final trip = trips[index - 2];
                final key = _itemKeys.putIfAbsent(trip.id, () => GlobalKey());
                return RepaintBoundary(
                  key: key,
                  child: _tripCard(context, trip, provider,
                      highlighted: provider.highlightTripId == trip.id),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCards(Map<String, dynamic> s) {
    return Row(children: [
      Expanded(child: _summaryCard('Total Requests', s['total_requests']?.toString() ?? '0', Colors.blue)),
      const SizedBox(width: 10),
      Expanded(child: _summaryCard('Approved', s['approved_trips']?.toString() ?? '0', Colors.green)),
      const SizedBox(width: 10),
      Expanded(child: _summaryCard('Revenue', 'Rs. ${_fmt(s['total_revenue'])}', Colors.orange)),
    ]);
  }

  String _fmt(dynamic val) {
    if (val == null) return '0';
    final d = double.tryParse(val.toString()) ?? 0;
    if (d >= 1000000) return '${(d / 1000000).toStringAsFixed(1)}M';
    if (d >= 1000) return '${(d / 1000).toStringAsFixed(1)}K';
    return d.toStringAsFixed(0);
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.black54), textAlign: TextAlign.center),
      ]),
    );
  }

  static const _statusColors = {
    'pending': Colors.orange,
    'quoted': Colors.purple,
    'approved': Colors.green,
    'rejected': Colors.red,
    'completed': Colors.blue,
    'not_complete': Colors.deepOrange,
  };

  Widget _tripCard(BuildContext context, Trip trip, AppProvider provider,
      {bool highlighted = false}) {
    final color = _statusColors[trip.status] ?? Colors.grey;

    return GestureDetector(
      onTap: () {
        if (highlighted) provider.setHighlightTripId(null);
        _showDetail(context, trip);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: highlighted ? Colors.amber.shade50 : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: highlighted
                ? Colors.amber.shade600
                : trip.status == 'quoted'
                    ? Colors.purple.shade300
                    : Colors.grey.shade200,
            width: highlighted || trip.status == 'quoted' ? 2 : 1,
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Header row
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
              child: Text(trip.status.toUpperCase(), style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700)),
            ),
            Text(trip.createdAt.substring(0, 10), style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ]),

          const SizedBox(height: 8),
          Text(trip.route, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          Row(children: [
            Text(trip.containerType.replaceAll('_', ' '), style: const TextStyle(fontSize: 12, color: Colors.grey)),
            if (trip.forceCompleted) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.orange.shade100, borderRadius: BorderRadius.circular(4)),
                child: Text('⚡ Force Completed', style: TextStyle(fontSize: 10, color: Colors.orange.shade800, fontWeight: FontWeight.w600)),
              ),
            ],
          ]),

          // QUOTED: admin has priced it, agent needs to respond
          if (trip.status == 'quoted' && trip.adminFinalPrice != null)
            _quotedActionCard(context, trip, provider),

          // APPROVED: Bilty + POD upload buttons
          if (trip.status == 'approved') ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: OutlinedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push(context,
                    MaterialPageRoute(builder: (_) => BiltyUploadScreen(trip: trip)));
                  if (result == true) provider.loadLedger();
                },
                icon: const Icon(Icons.description_outlined, size: 16),
                label: const Text('Bilty', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.blue.shade700,
                  side: BorderSide(color: Colors.blue.shade300),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
              )),
              const SizedBox(width: 8),
              Expanded(child: _quickUploadBtn(
                context, trip, provider,
                label: 'POD',
                icon: Icons.check_circle_outline,
                color: Colors.green.shade700,
                endpoint: '/api/trips/${trip.id}/bilty/pod',
              )),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () async {
                  final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => BiltyScreen(trip: trip)));
                  if (result == true) provider.loadLedger();
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.grey.shade600,
                  side: BorderSide(color: Colors.grey.shade300),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: const Icon(Icons.more_horiz, size: 20),
              ),
            ]),
          ],

          // APPROVED: show final price + vehicle/driver
          if (trip.status == 'approved' && trip.adminFinalPrice != null) ...[
            const SizedBox(height: 8),
            Text(
              'Approved Price: Rs. ${trip.adminFinalPrice!.toStringAsFixed(0)}',
              style: TextStyle(fontSize: 13, color: Colors.green.shade700, fontWeight: FontWeight.w600),
            ),
            if (trip.plateNumber != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Vehicle: ${trip.plateNumber}  •  Driver: ${trip.driverName ?? "—"}${trip.driverPhone != null ? "  •  ${trip.driverPhone}" : ""}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
            if (trip.paymentType != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(children: [
                  Icon(
                    trip.paymentType == 'bank' ? Icons.account_balance : Icons.money,
                    size: 13,
                    color: trip.paymentType == 'bank' ? Colors.blue.shade600 : Colors.green.shade700,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    trip.paymentType == 'bank' ? 'Bank Transfer' : 'Cash',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: trip.paymentType == 'bank' ? Colors.blue.shade600 : Colors.green.shade700,
                    ),
                  ),
                ]),
              ),
          ],

          // PENDING with counter offer
          if (trip.status == 'pending' && trip.agentRequestedPrice != null) ...[
            const SizedBox(height: 6),
            Text('Your Offer: Rs. ${trip.agentRequestedPrice!.toStringAsFixed(0)}',
              style: const TextStyle(fontSize: 12, color: Colors.orange, fontWeight: FontWeight.w500)),
          ],

          const SizedBox(height: 6),
          Text('Tap to view details', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
        ]),
      ),
    );
  }

  Widget _quickUploadBtn(BuildContext context, Trip trip, AppProvider provider,
      {required String label, required IconData icon, required Color color, required String endpoint}) {
    return OutlinedButton.icon(
      onPressed: () async {
        final picker = ImagePicker();
        final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
        if (picked == null) return;
        try {
          final bytes = await picked.readAsBytes();
          final base64Str = 'data:image/jpeg;base64,${base64Encode(bytes)}';
          await ApiService.post(endpoint, {'image_base64': base64Str});
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('$label uploaded!'),
              backgroundColor: color,
            ));
          }
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700));
          }
        }
      },
      icon: Icon(icon, size: 16),
      label: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withOpacity(0.5)),
        padding: const EdgeInsets.symmetric(vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    );
  }

  Widget _quotedActionCard(BuildContext context, Trip trip, AppProvider provider) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.purple.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.purple.shade200),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Admin Quoted Price', style: TextStyle(fontSize: 11, color: Colors.purple.shade700, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(
          'Rs. ${trip.adminFinalPrice!.toStringAsFixed(0)}',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.purple.shade700),
        ),
        if (trip.plateNumber != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              'Vehicle: ${trip.plateNumber}  •  Driver: ${trip.driverName ?? "—"}${trip.driverPhone != null ? "\nPhone: ${trip.driverPhone}" : ""}',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ),
        const SizedBox(height: 12),
        // 3 action buttons
        Row(children: [
          Expanded(child: _actionBtn('Accept', Colors.green, () => _confirm(context, trip.id, 'accept', provider))),
          const SizedBox(width: 8),
          Expanded(child: _actionBtn('Reject', Colors.red, () => _confirm(context, trip.id, 'reject', provider))),
          if (!trip.agentRepriced) ...[
            const SizedBox(width: 8),
            Expanded(child: _actionBtn('Re-Price', Colors.blue, () => _showCounterDialog(context, trip.id, provider, trip))),
          ],
        ]),
      ]),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) {
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        elevation: 0,
        minimumSize: const Size(0, 36),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }

  Future<void> _confirm(BuildContext context, String tripId, String action, AppProvider provider) async {
    try {
      await ApiService.post('/api/agent/trips/$tripId/confirm', {'action': action});
      await provider.loadLedger();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(action == 'accept' ? 'Trip accepted!' : 'Trip rejected.'),
          backgroundColor: action == 'accept' ? Colors.green.shade700 : Colors.red.shade700,
        ));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700));
      }
    }
  }

  void _showCounterDialog(BuildContext context, String tripId, AppProvider provider, Trip trip) {
    final ctrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send Counter Price', style: TextStyle(fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Admin quoted: Rs. ${trip.adminFinalPrice?.toStringAsFixed(0) ?? '—'}',
              style: TextStyle(fontSize: 12, color: Colors.purple.shade700, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Your Counter Price (PKR)',
                prefixText: 'Rs. ',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final price = int.tryParse(ctrl.text.trim());
              if (price == null || price <= 0) return;
              Navigator.pop(ctx);
              try {
                await ApiService.post('/api/agent/trips/$tripId/counter', {'new_price': price});
                await provider.loadLedger();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Counter price sent to admin.'), backgroundColor: Colors.blue),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
                  );
                }
              }
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
  }

  void _showDetail(BuildContext context, Trip trip) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TripDetailSheet(trip: trip),
    );
  }
}

class _TripDetailSheet extends StatelessWidget {
  final Trip trip;
  const _TripDetailSheet({required this.trip});

  @override
  Widget build(BuildContext context) {
    final color = {
      'pending': Colors.orange, 'quoted': Colors.purple,
      'approved': Colors.green, 'rejected': Colors.red, 'completed': Colors.blue,
    }[trip.status] ?? Colors.grey;

    return Container(
      height: MediaQuery.of(context).size.height * 0.78,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Trip Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
        ]),
        const Divider(),
        Expanded(
          child: SingleChildScrollView(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _row('Status', trip.status.toUpperCase(), valueColor: color),
              _row('Date', trip.createdAt.substring(0, 10)),
              _row('Container', trip.containerType.replaceAll('_', ' ')),
              const SizedBox(height: 14),
              const Text('Route', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.black54)),
              const SizedBox(height: 6),
              _locRow(Icons.radio_button_checked, Colors.green, trip.pickupLocation),
              ...trip.dropoffLocations.map((d) => _locRow(Icons.location_on, Colors.red, d)),
              const SizedBox(height: 14),
              const Divider(),
              const SizedBox(height: 8),
              const Text('Pricing', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.black54)),
              const SizedBox(height: 6),
              if (trip.systemEstimatedPrice != null)
                _row('System Estimate', 'Rs. ${trip.systemEstimatedPrice!.toStringAsFixed(0)}'),
              if (trip.agentRequestedPrice != null)
                _row('Your Offer', 'Rs. ${trip.agentRequestedPrice!.toStringAsFixed(0)}', valueColor: Colors.orange),
              if (trip.adminFinalPrice != null)
                _row('Admin Final Price', 'Rs. ${trip.adminFinalPrice!.toStringAsFixed(0)}', valueColor: color),
              if (trip.plateNumber != null || trip.paymentType != null) ...[
                const SizedBox(height: 14),
                const Divider(),
                const SizedBox(height: 8),
                const Text('Assignment', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.black54)),
                const SizedBox(height: 6),
                if (trip.plateNumber != null) _row('Vehicle', trip.plateNumber!),
                if (trip.driverName != null) _row('Driver', trip.driverName!),
                if (trip.driverPhone != null) _row('Driver Phone', trip.driverPhone!),
                if (trip.paymentType != null)
                  _row(
                    'Payment Method',
                    trip.paymentType == 'bank' ? 'Bank Transfer' : 'Cash',
                    valueColor: trip.paymentType == 'bank' ? Colors.blue.shade600 : Colors.green.shade700,
                  ),
              ],
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _row(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey)),
        Flexible(child: Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: valueColor ?? Colors.black87), textAlign: TextAlign.right)),
      ]),
    );
  }

  Widget _locRow(IconData icon, Color color, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
      ]),
    );
  }
}
