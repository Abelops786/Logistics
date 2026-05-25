import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../models/trip.dart';
import '../services/api_service.dart';

class AppProvider extends ChangeNotifier {
  User? _user;
  String? _token;
  List<Trip> _trips = [];
  Map<String, dynamic>? _ledgerSummary;
  List<Map<String, dynamic>> _notifications = [];
  int _unreadCount = 0;
  Timer? _pollTimer;

  User? get user => _user;
  String? get token => _token;
  List<Trip> get trips => _trips;
  Map<String, dynamic>? get ledgerSummary => _ledgerSummary;
  List<Map<String, dynamic>> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoggedIn => _token != null && _user != null;

  Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final userJson = prefs.getString('user');
    if (userJson != null) {
      _user = User.fromJson(jsonDecode(userJson));
    }
    notifyListeners();
    if (_token != null) {
      _startPolling();
      _pollNotifications();
    }
  }

  Future<Map<String, dynamic>> login(String phone, String password) async {
    try {
      final res = await ApiService.post(
        '/api/auth/login',
        {'phone': phone, 'password': password},
        auth: false,
      );
      if (res.containsKey('token')) {
        _token = res['token'];
        _user = User.fromJson(res['user']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', _token!);
        await prefs.setString('user', jsonEncode(res['user']));
        notifyListeners();
        _startPolling();
        _pollNotifications();
      }
      return res;
    } on ApiException catch (e) {
      // 403 means pending or suspended — return body so screen can show proper message
      if (e.statusCode == 403 && e.body != null) return e.body!;
      rethrow;
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _pollNotifications());
  }

  Future<void> _pollNotifications() async {
    try {
      final res = await ApiService.get('/api/agent/notifications');
      final list = (res['notifications'] as List).cast<Map<String, dynamic>>();
      final unread = res['unread_count'] as int? ?? 0;
      if (unread != _unreadCount) {
        _notifications = list;
        _unreadCount = unread;
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> loadNotifications() async {
    try {
      final res = await ApiService.get('/api/agent/notifications');
      _notifications = (res['notifications'] as List).cast<Map<String, dynamic>>();
      _unreadCount = res['unread_count'] as int? ?? 0;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markNotificationsRead() async {
    try {
      await ApiService.post('/api/agent/notifications/read-all', {});
      _unreadCount = 0;
      _notifications = _notifications.map((n) => {...n, 'is_read': true}).toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> logout() async {
    _pollTimer?.cancel();
    _token = null;
    _user = null;
    _trips = [];
    _ledgerSummary = null;
    _notifications = [];
    _unreadCount = 0;
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    notifyListeners();
  }

  Future<void> loadLedger() async {
    try {
      final res = await ApiService.get('/api/agent/ledger');
      _ledgerSummary = res['summary'];
      _trips = (res['history'] as List).map((t) => Trip.fromJson(t)).toList();
      notifyListeners();
    } catch (_) {}
  }
}
