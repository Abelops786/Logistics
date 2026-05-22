import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../models/trip.dart';

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
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<AppProvider>().loadLedger(),
          ),
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
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Text('No trips yet', style: TextStyle(color: Colors.grey.shade400)),
                    )
                  else
                    ...trips.map((t) => _tripCard(t)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCards(Map<String, dynamic> s) {
    return Row(
      children: [
        Expanded(child: _summaryCard('Total Requests', s['total_requests']?.toString() ?? '0', Colors.blue)),
        const SizedBox(width: 10),
        Expanded(child: _summaryCard('Approved', s['approved_trips']?.toString() ?? '0', Colors.green)),
        const SizedBox(width: 10),
        Expanded(child: _summaryCard('Revenue', 'Rs. ${_fmt(s['total_revenue'])}', Colors.orange)),
      ],
    );
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

  Widget _tripCard(Trip trip) {
    final statusColors = {
      'pending': Colors.orange,
      'approved': Colors.green,
      'rejected': Colors.red,
      'completed': Colors.blue,
    };
    final color = statusColors[trip.status] ?? Colors.grey;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                child: Text(trip.status.toUpperCase(), style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
              ),
              Text(
                trip.createdAt.substring(0, 10),
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(trip.route, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text(trip.containerType.replaceAll('_', ' '), style: const TextStyle(fontSize: 12, color: Colors.grey)),
          if (trip.adminFinalPrice != null) ...[
            const SizedBox(height: 6),
            Text(
              'Approved Price: Rs. ${trip.adminFinalPrice!.toStringAsFixed(0)}',
              style: TextStyle(fontSize: 13, color: Colors.green.shade700, fontWeight: FontWeight.w600),
            ),
          ] else if (trip.agentRequestedPrice != null) ...[
            const SizedBox(height: 6),
            Text('Your Offer: Rs. ${trip.agentRequestedPrice!.toStringAsFixed(0)}', style: const TextStyle(fontSize: 12, color: Colors.orange)),
          ],
        ],
      ),
    );
  }
}
