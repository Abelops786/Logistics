import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const String _baseUrl = 'https://logistics-production-1c64.up.railway.app';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, [this.statusCode]);
  @override
  String toString() => message;
}

class ApiService {
  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = {'Content-Type': 'application/json'};
    if (auth) {
      final token = await _getToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static Future<dynamic> _handleResponse(http.Response res) async {
    dynamic body;
    try {
      body = jsonDecode(res.body);
    } catch (_) {
      body = {'message': res.body.isNotEmpty ? res.body : 'Server error'};
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    final msg = (body is Map ? body['message'] : null) ?? 'Error ${res.statusCode}';
    throw ApiException(msg, res.statusCode);
  }

  static Future<dynamic> post(String path, Map<String, dynamic> body, {bool auth = true}) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl$path'),
        headers: await _headers(auth: auth),
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 20));
      return await _handleResponse(res);
    } on ApiException {
      rethrow;
    } on SocketException {
      throw ApiException('No internet connection. Please check your network.');
    } on HttpException {
      throw ApiException('Could not reach server. Try again.');
    } catch (e) {
      throw ApiException('Request timed out. Please try again.');
    }
  }

  static Future<dynamic> get(String path) async {
    try {
      final res = await http.get(
        Uri.parse('$_baseUrl$path'),
        headers: await _headers(),
      ).timeout(const Duration(seconds: 20));
      return await _handleResponse(res);
    } on ApiException {
      rethrow;
    } on SocketException {
      throw ApiException('No internet connection. Please check your network.');
    } catch (e) {
      throw ApiException('Request timed out. Please try again.');
    }
  }

  static Future<dynamic> put(String path, Map<String, dynamic> body) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl$path'),
        headers: await _headers(),
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 20));
      return await _handleResponse(res);
    } on ApiException {
      rethrow;
    } on SocketException {
      throw ApiException('No internet connection. Please check your network.');
    } catch (e) {
      throw ApiException('Request timed out. Please try again.');
    }
  }
}
