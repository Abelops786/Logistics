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

  User? get user => _user;
  String? get token => _token;
  List<Trip> get trips => _trips;
  Map<String, dynamic>? get ledgerSummary => _ledgerSummary;
  bool get isLoggedIn => _token != null && _user != null;

  Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final userJson = prefs.getString('user');
    if (userJson != null) {
      _user = User.fromJson(jsonDecode(userJson));
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> login(String phone, String password) async {
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
    }
    return res;
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _trips = [];
    _ledgerSummary = null;
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
