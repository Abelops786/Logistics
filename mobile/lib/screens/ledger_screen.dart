import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../models/trip.dart';
import '../services/api_service.dart';

class LedgerScreen extends StatefulWidget {
  const LedgerScreen({super.key});
  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppProvider>().loadLedger();
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
          return RefreshIndicator(
            onRefresh: provider.loadLedger,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (summary != null) _buildSummaryCards(summary),
                  const SizedBox(height: 20),
                  const Text('Trip History', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  if (trips.isEmpty)
                    Container(padding: const EdgeInsets.all(40), alignment: Alignment.center,
                      child: Text('No trips yet', style: TextStyle(color: Colors.grey.shade400)))
                  else
                    ...trips.map((t) => _tripCard(context, t, provider)),
                ],
              ),
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
    if (d >= 1000) return '${(d / 1000).toStringAsFixed(1)}K';
    return d.toStringAsFixed(0);
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.black54), textAlign: TextAlign.center),
      ]),
    );
  }

  Widget _tripCard(BuildContext context, Trip trip, AppProvider provider) {
    final statusColors = {
      'pending': Colors.orange,
      'quoted': Colors.purple,
      'approved': Colors.green,
      'rejected': Colors.red,
      'completed': Colors.blue,
    };
    final color = statusColors[trip.status] ?? Colors.grey;

    return GestureDetector(
      onTap: () => _showTripDetail(context, trip, provider),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(10),
          border: Border.all(color: trip.status == 'quoted' ? Colors.purple.shade200 : Colors.grey.shade200, width: trip.status == 'quoted' ? 2 : 1),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
              child: Text(trip.status.toUpperCase(), style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
            ),
            Text(trip.createdAt.substring(0, 10), style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ]),
          const SizedBox(height: 8),
          Text(trip.route, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          Text(trip.containerType.replaceAll('_', ' '), style: const TextStyle(fontSize: 12, color: Colors.grey)),

          // Quoted: admin set a price, agent needs to confirm
          if (trip.status == 'quoted' && trip.adminFinalPrice != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.purple.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.purple.shade200)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Admin Quoted Price', style: TextStyle(fontSize: 11, color: Colors.purple.shade700, fontWeight: FontWeight.w600)),
                Text('Rs. ${trip.adminFinalPrice!.toStringAsFixed(0)}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.purple.shade700)),
                if (trip.plateNumber != null) Text('Vehicle: ${trip.plateNumber}  •  Driver: ${trip.driverName ?? "—"}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: _confirmBtn(context, trip.id, 'accept', provider)),
                  const SizedBox(width: 10),
                  Expanded(child: _confirmBtn(context, trip.id, 'reject', provider)),
                ]),
              ]),
            ),
          ] else if (trip.adminFinalPrice != null) ...[
            const SizedBox(height: 6),
            Text('Approved Price: Rs. ${trip.adminFinalPrice!.toStringAsFixed(0)}',
              style: TextStyle(fontSize: 13, color: Colors.green.shade700, fontWeight: FontWeight.w600)),
            if (trip.plateNumber != null)
              Text('Vehicle: ${trip.plateNumber}  •  Driver: ${trip.driverName ?? "—"}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ] else if (trip.agentRequestedPrice != null) ...[
            const SizedBox(height: 6),
            Text('Your Offer: Rs. ${trip.agentRequestedPrice!.toStringAsFixed(0)}', style: const TextStyle(fontSize: 12, color: Colors.orange)),
          ],

          // Tap for details hint
          const SizedBox(height: 6),
          Text('Tap to view details', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
        ]),
      ),
    );
  }

  Widget _confirmBtn(BuildContext context, String tripId, String action, AppProvider provider) {
    final isAccept = action == 'accept';
    return ElevatedButton(
      onPressed: () => _confirmTrip(context, tripId, action, provider),
      style: ElevatedButton.styleFrom(
        backgroundColor: isAccept ? Colors.green : Colors.red,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        elevation: 0,
      ),
      child: Text(isAccept ? 'Accept Price' : 'Reject', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }

  Future<void> _confirmTrip(BuildContext context, String tripId, String action, AppProvider provider) async {
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red.shade700));
      }
    }
  }

  void _showTripDetail(BuildContext context, Trip trip, AppProvider provider) {
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
    final statusColors = {
      'pending': Colors.orange, 'quoted': Colors.purple,
      'approved': Colors.green, 'rejected': Colors.red, 'completed': Colors.blue,
    };
    final color = statusColors[trip.status] ?? Colors.grey;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Trip Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
        ]),
        const Divider(),
        const SizedBox(height: 8),
        _row('Status', trip.status.toUpperCase(), valueColor: color),
        _row('Date', trip.createdAt.substring(0, 10)),
        _row('Container', trip.containerType.replaceAll('_', ' ')),
        const SizedBox(height: 12),
        const Text('Route', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        const SizedBox(height: 4),
        _locationRow(Icons.radio_button_checked, Colors.green, trip.pickupLocation),
        ...trip.dropoffLocations.map((d) => _locationRow(Icons.location_on, Colors.red, d)),
        const SizedBox(height: 12),
        const Divider(),
        const SizedBox(height: 8),
        if (trip.systemEstimatedPrice != null) _row('System Estimate', 'Rs. ${trip.systemEstimatedPrice!.toStringAsFixed(0)}'),
        if (trip.agentRequestedPrice != null) _row('Your Offer', 'Rs. ${trip.agentRequestedPrice!.toStringAsFixed(0)}', valueColor: Colors.orange),
        if (trip.adminFinalPrice != null) _row('Admin Final Price', 'Rs. ${trip.adminFinalPrice!.toStringAsFixed(0)}', valueColor: color),
        if (trip.plateNumber != null) ...[
          const SizedBox(height: 12),
          const Divider(),
          const SizedBox(height: 8),
          const Text('Assignment', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 4),
          _row('Vehicle', trip.plateNumber!),
          if (trip.driverName != null) _row('Driver', trip.driverName!),
        ],
      ]),
    );
  }

  Widget _row(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey)),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: valueColor ?? Colors.black87)),
      ]),
    );
  }

  Widget _locationRow(IconData icon, Color color, String text) {
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
