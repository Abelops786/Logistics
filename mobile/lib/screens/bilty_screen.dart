import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../models/trip.dart';

class BiltyScreen extends StatefulWidget {
  final Trip trip;
  const BiltyScreen({super.key, required this.trip});
  @override
  State<BiltyScreen> createState() => _BiltyScreenState();
}

class _BiltyScreenState extends State<BiltyScreen> {
  final _biltyNoCtrl = TextEditingController();
  final _freightCtrl = TextEditingController();
  String _category = 'corporate';
  String _invoiceType = 'gst';
  double _grossWeight = 1.0;
  String _podRequired = 'yes';
  int _creditTerm = 7;
  String _transitLoss = 'customer';
  File? _image;
  bool _submitting = false;
  bool _loadingExisting = true;
  Map<String, dynamic>? _existingBilty;

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
          _existingBilty = b;
          _biltyNoCtrl.text = b['bilty_no'] ?? '';
          _freightCtrl.text = b['freight']?.toString() ?? '';
          _category = b['category'] ?? 'corporate';
          _invoiceType = b['invoice_type'] ?? 'gst';
          _grossWeight = double.tryParse(b['gross_weight_mt']?.toString() ?? '1') ?? 1.0;
          _podRequired = b['pod_required'] ?? 'yes';
          _creditTerm = int.tryParse(b['credit_term_days']?.toString() ?? '7') ?? 7;
          _transitLoss = b['transit_loss'] ?? 'customer';
        });
      }
    } catch (_) {}
    setState(() => _loadingExisting = false);
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (picked != null) setState(() => _image = File(picked.path));
  }

  Future<void> _pickFromGallery() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (picked != null) setState(() => _image = File(picked.path));
  }

  Future<void> _submit() async {
    if (_image == null && _existingBilty == null) {
      _showErr('Please take a photo of the bilty first.');
      return;
    }
    setState(() => _submitting = true);
    try {
      String? imageBase64;
      if (_image != null) {
        final bytes = await _image!.readAsBytes();
        imageBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }

      await ApiService.post('/api/trips/${widget.trip.id}/bilty', {
        'bilty_no': _biltyNoCtrl.text.trim(),
        'category': _category,
        'invoice_type': _invoiceType,
        'gross_weight_mt': _grossWeight,
        'freight': double.tryParse(_freightCtrl.text.trim()),
        'pod_required': _podRequired,
        'credit_term_days': _creditTerm,
        'transit_loss': _transitLoss,
        if (imageBase64 != null) 'image_base64': imageBase64,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Bilty uploaded successfully!'),
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
    if (_loadingExisting) return const Scaffold(body: Center(child: CircularProgressIndicator()));

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
          // Trip info banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.blue.shade200)),
            child: Row(children: [
              Icon(Icons.local_shipping, color: Colors.blue.shade700, size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text(widget.trip.route, style: TextStyle(fontSize: 12, color: Colors.blue.shade800, fontWeight: FontWeight.w500))),
            ]),
          ),
          const SizedBox(height: 16),

          // Job Number (read-only if existing)
          if (_existingBilty != null)
            _card('Job Info', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Job No: ${_existingBilty!['job_number']?.toString().padLeft(3, '0') ?? '—'}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.blue)),
            ])),

          // Image section
          _card('Bilty Photo', Column(children: [
            if (_image != null)
              ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(_image!, height: 180, width: double.infinity, fit: BoxFit.cover))
            else if (_existingBilty?['image_base64'] != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(base64Decode(_existingBilty!['image_base64'].toString().split(',').last),
                    height: 180, width: double.infinity, fit: BoxFit.cover),
              )
            else
              Container(
                height: 120, width: double.infinity,
                decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.camera_alt_outlined, size: 36, color: Colors.grey.shade400),
                  const SizedBox(height: 6),
                  Text('No photo yet', style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
                ]),
              ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: OutlinedButton.icon(onPressed: _pickImage, icon: const Icon(Icons.camera_alt, size: 18), label: const Text('Camera'))),
              const SizedBox(width: 10),
              Expanded(child: OutlinedButton.icon(onPressed: _pickFromGallery, icon: const Icon(Icons.photo_library, size: 18), label: const Text('Gallery'))),
            ]),
          ])),

          // Bilty details
          _card('Bilty Details', Column(children: [
            _textField(_biltyNoCtrl, 'Bilty No', 'e.g. BL-2024-001'),
            const SizedBox(height: 12),
            _dropdown('Category', _category, {'corporate': 'Corporate', 'open_market': 'Open Market'}, (v) => setState(() => _category = v!)),
            const SizedBox(height: 12),
            _dropdown('Invoice Type', _invoiceType, {'gst': 'GST', 'non_gst': 'Non-GST'}, (v) => setState(() => _invoiceType = v!)),
          ])),

          // Cargo
          _card('Cargo & Freight', Column(children: [
            _label('Gross Weight (MT)'),
            const SizedBox(height: 6),
            DropdownButtonFormField<double>(
              value: _grossWeight,
              decoration: _inputDec(),
              items: [for (var i = 1; i <= 30; i++) ...[
                DropdownMenuItem(value: i.toDouble(), child: Text('$i MT')),
                if (i < 30) DropdownMenuItem(value: i + 0.5, child: Text('${i}.5 MT')),
              ]],
              onChanged: (v) => setState(() => _grossWeight = v!),
            ),
            const SizedBox(height: 12),
            _textField(_freightCtrl, 'Freight (PKR)', 'e.g. 145320', keyboard: TextInputType.number),
          ])),

          // Terms
          _card('Terms & Conditions', Column(children: [
            _dropdown('POD Required', _podRequired, {'yes': 'Yes', 'no': 'No', 'scan': 'Scan'}, (v) => setState(() => _podRequired = v!)),
            const SizedBox(height: 12),
            _label('Credit Term (Days)'),
            const SizedBox(height: 6),
            DropdownButtonFormField<int>(
              value: _creditTerm,
              decoration: _inputDec(),
              items: [for (var i = 1; i <= 100; i++) DropdownMenuItem(value: i, child: Text('$i Days'))],
              onChanged: (v) => setState(() => _creditTerm = v!),
            ),
            const SizedBox(height: 12),
            _dropdown('Transit Loss Responsibility', _transitLoss,
                {'customer': 'At Customer End', 'transporter': 'At Transporter End'},
                (v) => setState(() => _transitLoss = v!)),
          ])),

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
                  : Text(_existingBilty != null ? 'Update Bilty' : 'Submit Bilty', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
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

  Widget _label(String text) => Text(text, style: const TextStyle(fontSize: 13, color: Colors.black54, fontWeight: FontWeight.w500));

  InputDecoration _inputDec({String? hint, String? prefix}) => InputDecoration(
    hintText: hint, prefixText: prefix,
    filled: true, fillColor: Colors.grey.shade50,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
  );

  Widget _textField(TextEditingController ctrl, String label, String hint, {TextInputType? keyboard}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _label(label),
      const SizedBox(height: 6),
      TextField(controller: ctrl, keyboardType: keyboard, decoration: _inputDec(hint: hint)),
    ],
  );

  Widget _dropdown(String label, String value, Map<String, String> options, ValueChanged<String?> onChanged) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _label(label),
      const SizedBox(height: 6),
      DropdownButtonFormField<String>(
        value: value,
        decoration: _inputDec(),
        items: options.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
        onChanged: onChanged,
      ),
    ],
  );
}
