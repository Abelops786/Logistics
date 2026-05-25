import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';

class AuthScreen extends StatefulWidget {
  final String? blockedMessage;
  const AuthScreen({super.key, this.blockedMessage});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLogin = true;
  bool _loading = false;
  bool _pendingBlock = false;
  String _pendingMessage = '';
  bool _isSuspended = false;

  @override
  void initState() {
    super.initState();
    if (widget.blockedMessage != null) {
      _pendingBlock = true;
      _pendingMessage = widget.blockedMessage!;
      _isSuspended = widget.blockedMessage!.toLowerCase().contains('suspend');
    }
  }

  // Login fields
  final _phoneCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  // Register fields
  final _nameCtrl = TextEditingController();
  final _regPhoneCtrl = TextEditingController();
  final _regPassCtrl = TextEditingController();
  final _cnicCtrl = TextEditingController();
  final _regionCtrl = TextEditingController();
  String? _cnicFrontB64;
  String? _cnicBackB64;

  Future<void> _pickImage(bool isFront) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 60);
    if (picked == null) return;
    final bytes = await File(picked.path).readAsBytes();
    final b64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    setState(() {
      if (isFront) { _cnicFrontB64 = b64; } else { _cnicBackB64 = b64; }
    });
  }

  Future<void> _handleLogin() async {
    setState(() => _loading = true);
    try {
      final res = await context.read<AppProvider>().login(_phoneCtrl.text.trim(), _passCtrl.text);
      if (res['status'] == 'pending' || res['status'] == 'suspended') {
        setState(() {
          _pendingBlock = true;
          _isSuspended = res['status'] == 'suspended';
          _pendingMessage = res['message'] ?? (_isSuspended ? 'Your account has been suspended.' : 'Your account is under review.');
        });
      } else if (res.containsKey('token')) {
        // Navigation handled by main.dart watching provider
      } else {
        _showError(res['message'] ?? 'Login failed');
      }
    } catch (e) {
      _showError('Network error. Please check your connection.');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleRegister() async {
    if (_cnicFrontB64 == null || _cnicBackB64 == null) {
      _showError('Please upload both CNIC front and back images.');
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await ApiService.post('/api/auth/register', {
        'name': _nameCtrl.text.trim(),
        'phone': _regPhoneCtrl.text.trim(),
        'password': _regPassCtrl.text,
        'cnic': _cnicCtrl.text.trim(),
        'region': _regionCtrl.text.trim(),
        'cnic_front_base64': _cnicFrontB64,
        'cnic_back_base64': _cnicBackB64,
      }, auth: false);

      if (res.containsKey('user')) {
        setState(() {
          _pendingBlock = true;
          _pendingMessage = 'Your profile is under review by Admin. You will receive a WhatsApp notification once approved.';
        });
      } else {
        _showError(res['message'] ?? res['errors']?.first?['msg'] ?? 'Registration failed');
      }
    } catch (e) {
      _showError('Network error. Please check your connection.');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700));
  }

  @override
  Widget build(BuildContext context) {
    if (_pendingBlock) {
      final color = _isSuspended ? Colors.red.shade700 : Colors.orange.shade700;
      final bgColor = _isSuspended ? Colors.red.shade50 : Colors.orange.shade50;
      final icon = _isSuspended ? Icons.block_rounded : Icons.access_time_rounded;
      final title = _isSuspended ? 'Account Suspended' : 'Account Not Approved';

      return Scaffold(
        backgroundColor: const Color(0xFF0A1628),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 80, height: 80,
                    decoration: BoxDecoration(color: bgColor, shape: BoxShape.circle),
                    child: Icon(icon, size: 42, color: color),
                  ),
                  const SizedBox(height: 24),
                  Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: color.withOpacity(0.4)),
                    ),
                    child: Text(
                      _pendingMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14, color: Colors.white70, height: 1.6),
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => setState(() { _pendingBlock = false; _isSuspended = false; _isLogin = true; }),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: color,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Back to Login', style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),
              const Text('R Transport', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
              const Text('Logistics Agent App', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 40),

              // Tab toggle
              Container(
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey.shade300)),
                child: Row(
                  children: [
                    _tabBtn('Login', _isLogin, () => setState(() => _isLogin = true)),
                    _tabBtn('Register', !_isLogin, () => setState(() => _isLogin = false)),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              if (_isLogin) _buildLogin() else _buildRegister(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tabBtn(String label, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? Colors.blue.shade700 : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
          ),
          alignment: Alignment.center,
          child: Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: active ? Colors.white : Colors.grey.shade600)),
        ),
      ),
    );
  }

  Widget _buildLogin() {
    return Column(
      children: [
        _field('Phone Number', _phoneCtrl, keyboard: TextInputType.phone),
        const SizedBox(height: 12),
        _field('Password', _passCtrl, obscure: true),
        const SizedBox(height: 24),
        _submitBtn('Sign In', _handleLogin),
      ],
    );
  }

  Widget _buildRegister() {
    return Column(
      children: [
        _field('Full Name', _nameCtrl),
        const SizedBox(height: 12),
        _field('Phone (WhatsApp)', _regPhoneCtrl, keyboard: TextInputType.phone),
        const SizedBox(height: 12),
        _field('Password', _regPassCtrl, obscure: true),
        const SizedBox(height: 12),
        _field('CNIC Number', _cnicCtrl, keyboard: TextInputType.number),
        const SizedBox(height: 12),
        _field('Region / City', _regionCtrl),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: _cnicPicker('CNIC Front', _cnicFrontB64, () => _pickImage(true))),
          const SizedBox(width: 12),
          Expanded(child: _cnicPicker('CNIC Back', _cnicBackB64, () => _pickImage(false))),
        ]),
        const SizedBox(height: 24),
        _submitBtn('Register', _handleRegister),
      ],
    );
  }

  Widget _field(String label, TextEditingController ctrl, {bool obscure = false, TextInputType? keyboard}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          keyboardType: keyboard,
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _cnicPicker(String label, String? b64, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 90,
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: b64 != null ? Colors.green : Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: b64 != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(7),
                child: Image.memory(base64Decode(b64.split(',').last), fit: BoxFit.cover),
              )
            : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.upload_file, color: Colors.grey.shade400),
                const SizedBox(height: 4),
                Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ]),
      ),
    );
  }

  Widget _submitBtn(String label, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue.shade700,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      ),
    );
  }
}
