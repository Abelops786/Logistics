import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import '../services/api_service.dart';
import '../models/trip.dart';

class BiltyUploadScreen extends StatefulWidget {
  final Trip trip;
  const BiltyUploadScreen({super.key, required this.trip});
  @override
  State<BiltyUploadScreen> createState() => _BiltyUploadScreenState();
}

class _BiltyUploadScreenState extends State<BiltyUploadScreen> {
  final _biltyNumberCtrl = TextEditingController();
  File? _selectedFile;
  String? _fileName;
  String? _fileType; // 'image' or 'pdf'
  String? _fileBase64;
  bool _submitting = false;
  Map<String, dynamic>? _existing;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  Future<void> _loadExisting() async {
    try {
      final res = await ApiService.get('/api/trips/${widget.trip.id}/bilty');
      if (res['bilty'] != null) {
        final b = res['bilty'] as Map<String, dynamic>;
        setState(() {
          _existing = b;
          _biltyNumberCtrl.text = b['bilty_number'] ?? '';
        });
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  Future<void> _pickCamera() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 80);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    setState(() {
      _selectedFile = File(picked.path);
      _fileName = picked.name;
      _fileType = 'image';
      _fileBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    });
  }

  Future<void> _pickGallery() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    setState(() {
      _selectedFile = File(picked.path);
      _fileName = picked.name;
      _fileType = 'image';
      _fileBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    });
  }

  Future<void> _pickPDF() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final bytes = file.bytes ?? await File(file.path!).readAsBytes();
    setState(() {
      _fileName = file.name;
      _fileType = 'pdf';
      _fileBase64 = 'data:application/pdf;base64,${base64Encode(bytes)}';
    });
  }

  Future<void> _submit() async {
    if (_biltyNumberCtrl.text.trim().isEmpty && _fileBase64 == null && _existing == null) {
      _showErr('Please enter bilty number or upload a document.');
      return;
    }
    setState(() => _submitting = true);
    try {
      await ApiService.post('/api/trips/${widget.trip.id}/bilty', {
        if (_biltyNumberCtrl.text.trim().isNotEmpty) 'bilty_number': _biltyNumberCtrl.text.trim(),
        if (_fileBase64 != null) 'bilty_file_base64': _fileBase64,
        if (_fileType != null) 'bilty_file_type': _fileType,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Bilty uploaded! Admin has been notified.'),
          backgroundColor: Colors.green,
        ));
        Navigator.pop(context, true);
      }
    } catch (e) {
      _showErr(e.toString());
    } finally {
      setState(() => _submitting = false);
    }
  }

  void _showErr(String msg) => ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700));

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final hasExistingFile = _existing?['bilty_file_base64'] != null || _existing?['image_base64'] != null;
    final existingBiltyNum = _existing?['bilty_number'];

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        title: const Text('Upload Bilty', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Trip banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.blue.shade200),
            ),
            child: Row(children: [
              Icon(Icons.local_shipping, color: Colors.blue.shade700, size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text(widget.trip.route,
                  style: TextStyle(fontSize: 12, color: Colors.blue.shade800, fontWeight: FontWeight.w500))),
            ]),
          ),
          const SizedBox(height: 16),

          // Bilty Number
          _card('Bilty Number', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (existingBiltyNum != null && existingBiltyNum.toString().isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(6), border: Border.all(color: Colors.green.shade200)),
                child: Row(children: [
                  Icon(Icons.check_circle, size: 16, color: Colors.green.shade700),
                  const SizedBox(width: 6),
                  Text('Current: $existingBiltyNum', style: TextStyle(fontSize: 13, color: Colors.green.shade800, fontWeight: FontWeight.w500)),
                ]),
              ),
            TextField(
              controller: _biltyNumberCtrl,
              decoration: InputDecoration(
                labelText: 'Bilty Number',
                hintText: 'e.g. BL-2024-001',
                filled: true,
                fillColor: Colors.grey.shade50,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
              ),
            ),
          ])),

          // Document Upload
          _card('Bilty Document', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Show existing
            if (hasExistingFile && _fileBase64 == null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.green.shade200)),
                child: Row(children: [
                  Icon(Icons.check_circle, color: Colors.green.shade700, size: 20),
                  const SizedBox(width: 8),
                  Text('Document already uploaded', style: TextStyle(color: Colors.green.shade800, fontSize: 13, fontWeight: FontWeight.w500)),
                ]),
              ),
              const SizedBox(height: 10),
              Text('Upload again to replace:', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              const SizedBox(height: 8),
            ],

            // Show selected file preview
            if (_fileBase64 != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.blue.shade200)),
                child: Row(children: [
                  Icon(_fileType == 'pdf' ? Icons.picture_as_pdf : Icons.image, color: Colors.blue.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_fileName ?? 'File selected', style: TextStyle(fontSize: 12, color: Colors.blue.shade800), overflow: TextOverflow.ellipsis)),
                  Icon(Icons.check_circle, color: Colors.green.shade600, size: 20),
                ]),
              ),
              const SizedBox(height: 10),
            ],

            // Upload buttons
            Row(children: [
              Expanded(child: _uploadBtn(Icons.camera_alt, 'Camera', Colors.blue.shade700, _pickCamera)),
              const SizedBox(width: 8),
              Expanded(child: _uploadBtn(Icons.photo_library, 'Gallery', Colors.purple.shade700, _pickGallery)),
              const SizedBox(width: 8),
              Expanded(child: _uploadBtn(Icons.picture_as_pdf, 'PDF', Colors.red.shade700, _pickPDF)),
            ]),
          ])),

          const SizedBox(height: 8),

          // Info box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.amber.shade200)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.info_outline, size: 18, color: Colors.amber.shade800),
              const SizedBox(width: 8),
              Expanded(child: Text(
                'Admin will be notified when you submit. Upload the bilty document received from the driver.',
                style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
              )),
            ]),
          ),

          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade700,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: _submitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_existing != null ? 'Update Bilty' : 'Submit Bilty & Notify Admin',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }

  Widget _card(String title, Widget child) => Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      const SizedBox(height: 12),
      child,
    ]),
  );

  Widget _uploadBtn(IconData icon, String label, Color color, VoidCallback onTap) => OutlinedButton.icon(
    onPressed: onTap,
    icon: Icon(icon, size: 16),
    label: Text(label, style: const TextStyle(fontSize: 12)),
    style: OutlinedButton.styleFrom(
      foregroundColor: color,
      side: BorderSide(color: color.withOpacity(0.4)),
      padding: const EdgeInsets.symmetric(vertical: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
  );
}
