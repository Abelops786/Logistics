import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final provider = context.read<AppProvider>();
      await provider.loadNotifications();
      await provider.markNotificationsRead();
    });
  }

  static const _typeIcons = {
    'trip_quoted': Icons.price_change,
    'trip_approved': Icons.check_circle,
    'trip_rejected': Icons.cancel,
    'account_approved': Icons.verified_user,
  };

  static const _typeColors = {
    'trip_quoted': Colors.purple,
    'trip_approved': Colors.green,
    'trip_rejected': Colors.red,
    'account_approved': Colors.blue,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        title: const Text('Notifications', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          final notifs = provider.notifications;
          if (notifs.isEmpty) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.notifications_none, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text('No notifications yet', style: TextStyle(color: Colors.grey.shade400, fontSize: 15)),
              ]),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: notifs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final n = notifs[i];
              final type = n['type'] as String? ?? '';
              final isRead = n['is_read'] == true;
              final color = _typeColors[type] ?? Colors.grey;
              final icon = _typeIcons[type] ?? Icons.notifications;
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isRead ? Colors.white : color.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isRead ? Colors.grey.shade200 : color.withOpacity(0.3)),
                ),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                    child: Icon(icon, color: color, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(n['title'] ?? '', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: isRead ? Colors.black87 : Colors.black))),
                      if (!isRead) Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                    ]),
                    const SizedBox(height: 4),
                    Text(n['body'] ?? '', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 4),
                    Text(
                      (n['created_at'] as String?)?.substring(0, 16).replaceFirst('T', ' ') ?? '',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                    ),
                  ])),
                ]),
              );
            },
          );
        },
      ),
    );
  }
}
