import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../models/trip.dart';

class BiltyScreen extends StatefulWidget {
  final Trip trip;
  const BiltyScreen({super.key, required this.trip});
  @override
  State<BiltyScreen> createState() => _BiltyScreenState();
}

class _BiltyScreenState extends State<BiltyScreen> {
  // Controllers
  final _biltyNoCtrl = TextEditingController();
  final _customerNameCtrl = TextEditingController();
  final _freightCtrl = TextEditingController();
  final _creditTermCtrl = TextEditingController();
  final _vehicleSearchCtrl = TextEditingController();

  // State
  DateTime _bookingDate = DateTime.now();
  String _nextJobNumber = '...';
  String _category = 'corporate';
  String _invoiceType = 'gst';
  double _grossWeight = 1.0;
  String _podRequired = 'yes';
  String _transitLoss = 'customer';
  String _selectedVehicleNo = '';
  String _containerSize = '';
  String _origin = '';
  String _destination = '';

  // File
  String? _fileBase64;
  String? _fileType;
  String? _fileName;

  // Vehicles for dropdown
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _filteredVehicles = [];
  bool _showVehicleList = false;

  bool _loading = true;
  bool _submitting = false;
  Map<String, dynamic>? _existing;

  @override
  void initState() {
    super.initState();
    // Pre-fill from trip
    _customerNameCtrl.text = widget.trip.clientName ?? '';
    _origin = widget.trip.pickupLocation;
    _destination = widget.trip.dropoffLocations.join(' → ');
    _selectedVehicleNo = widget.trip.plateNumber ?? '';
    _containerSize = widget.trip.containerType.replaceAll('_', ' ');
    _vehicleSearchCtrl.text = _selectedVehicleNo;
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        ApiService.get('/api/trips/bilty/next-job'),
        ApiService.get('/api/trips/${widget.trip.id}/bilty'),
        ApiService.get('/api/agent/vehicles').catchError((_) => <String, dynamic>{'result': []}),
      ]);

      _nextJobNumber = results[0]['job_number'] ?? '001';

      if (results[1]['bilty'] != null) {
        final b = results[1]['bilty'] as Map<String, dynamic>;
        _existing = b;
        _biltyNoCtrl.text = b['bilty_no'] ?? b['bilty_number'] ?? '';
        _customerNameCtrl.text = b['customer_name'] ?? widget.trip.clientName ?? '';
        _freightCtrl.text = b['freight']?.toString() ?? '';
        _category = b['category'] ?? 'corporate';
        _invoiceType = b['invoice_type'] ?? 'gst';
        _grossWeight = double.tryParse(b['gross_weight_mt']?.toString() ?? '1') ?? 1.0;
        _podRequired = b['pod_required'] ?? 'yes';
        _transitLoss = b['transit_loss'] ?? 'customer';
        _selectedVehicleNo = b['vehicle_no'] ?? widget.trip.plateNumber ?? '';
        _containerSize = b['container_size'] ?? widget.trip.containerType.replaceAll('_', ' ');
        _origin = b['origin'] ?? widget.trip.pickupLocation;
        _destination = b['destination'] ?? widget.trip.dropoffLocations.join(' → ');
        _vehicleSearchCtrl.text = _selectedVehicleNo;
        if (b['booking_date'] != null) {
          _bookingDate = DateTime.tryParse(b['booking_date']) ?? DateTime.now();
        }
        _nextJobNumber = b['job_number'] != null ? String.fromCharCodes(b['job_number'].toString().codeUnits).padLeft(3, '0') : _nextJobNumber;
      }

      // Load vehicles
      final vehiclesData = results[2];
      if (vehiclesData is List) {
        _vehicles = List<Map<String, dynamic>>.from(vehiclesData);
        _filteredVehicles = _vehicles;
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  void _filterVehicles(String q) {
    setState(() {
      _showVehicleList = q.isNotEmpty;
      _filteredVehicles = q.isEmpty
          ? _vehicles
          : _vehicles.where((v) => (v['plate_number'] ?? '').toString().toLowerCase().contains(q.toLowerCase())).toList();
    });
  }

  void _selectVehicle(Map<String, dynamic> v) {
    setState(() {
      _selectedVehicleNo = v['plate_number'] ?? '';
      _containerSize = (v['container_type'] ?? '').toString().replaceAll('_', ' ');
      _vehicleSearchCtrl.text = _selectedVehicleNo;
      _showVehicleList = false;
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _bookingDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _bookingDate = picked);
  }

  Future<void> _pickCamera() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 80);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    setState(() { _fileBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}'; _fileType = 'image'; _fileName = picked.name; });
  }

  Future<void> _pickGallery() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    setState(() { _fileBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}'; _fileType = 'image'; _fileName = picked.name; });
  }

  Future<void> _pickPDF() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final bytes = file.bytes ?? await File(file.path!).readAsBytes();
    setState(() { _fileBase64 = 'data:application/pdf;base64,${base64Encode(bytes)}'; _fileType = 'pdf'; _fileName = file.name; });
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ApiService.post('/api/trips/${widget.trip.id}/bilty', {
        'bilty_no': _biltyNoCtrl.text.trim(),
        'bilty_number': _biltyNoCtrl.text.trim(),
        'customer_name': _customerNameCtrl.text.trim(),
        'booking_date': DateFormat('yyyy-MM-dd').format(_bookingDate),
        'category': _category,
        'invoice_type': _invoiceType,
        'vehicle_no': _selectedVehicleNo,
        'container_size': _containerSize,
        'origin': _origin,
        'destination': _destination,
        'gross_weight_mt': _grossWeight,
        'freight': double.tryParse(_freightCtrl.text.trim()),
        'pod_required': _podRequired,
        'credit_term_days': int.tryParse(_creditTermCtrl.text.trim()) ?? 0,
        'transit_loss': _transitLoss,
        if (_fileBase64 != null) 'bilty_file_base64': _fileBase64,
        if (_fileType != null) 'bilty_file_type': _fileType,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bilty saved! Admin notified.'), backgroundColor: Colors.green));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700));
    } finally { setState(() => _submitting = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        title: const Text('Bilty Form', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: GestureDetector(
        onTap: () => setState(() => _showVehicleList = false),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

            // ── 1. Job Number (auto) + Booking Date ──
            _card(Column(children: [
              Row(children: [
                Expanded(child: _readOnlyField('Job No', _existing != null
                    ? '#${_existing!['job_number'].toString().padLeft(3,'0')}'
                    : 'Auto: #$_nextJobNumber', Colors.blue.shade700)),
                const SizedBox(width: 12),
                Expanded(child: GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                    decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey.shade300)),
                    child: Row(children: [
                      Icon(Icons.calendar_today, size: 16, color: Colors.blue.shade700),
                      const SizedBox(width: 8),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Booking Date', style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                        Text(DateFormat('dd MMM yyyy').format(_bookingDate), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      ]),
                    ]),
                  ),
                )),
              ]),
            ])),

            // ── 2. Bilty No + Customer Name ──
            _card(Column(children: [
              _textField(_biltyNoCtrl, 'Bilty No', 'e.g. BL-2024-001'),
              const SizedBox(height: 12),
              _textField(_customerNameCtrl, 'Customer Name', 'e.g. Ali Hassan'),
            ])),

            // ── 3. Category + Invoice ──
            _card(Row(children: [
              Expanded(child: _dropdown('Category', _category, {'corporate': 'Corporate', 'open_market': 'Open Market'}, (v) => setState(() => _category = v!))),
              const SizedBox(width: 12),
              Expanded(child: _dropdown('Invoice', _invoiceType, {'gst': 'GST', 'non_gst': 'Non-GST'}, (v) => setState(() => _invoiceType = v!))),
            ])),

            // ── 4. Vehicle No (searchable) + Container Size (auto) ──
            _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _label('Vehicle No'),
              const SizedBox(height: 6),
              TextField(
                controller: _vehicleSearchCtrl,
                onChanged: _filterVehicles,
                decoration: _inputDec(hint: 'Search e.g. AAAB-741'),
              ),
              if (_showVehicleList && _filteredVehicles.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey.shade300), boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4)]),
                  constraints: const BoxConstraints(maxHeight: 200),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _filteredVehicles.length,
                    itemBuilder: (_, i) {
                      final v = _filteredVehicles[i];
                      return ListTile(
                        dense: true,
                        title: Text(v['plate_number'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: Text((v['container_type'] ?? '').toString().replaceAll('_', ' '), style: const TextStyle(fontSize: 11)),
                        onTap: () => _selectVehicle(v),
                      );
                    },
                  ),
                ),
              const SizedBox(height: 12),
              _readOnlyField('Container Size (Auto)', _containerSize.isEmpty ? 'Select vehicle above' : _containerSize, Colors.grey.shade700),
            ])),

            // ── 5. Origin + Destination ──
            _card(Column(children: [
              _editableField('Origin', _origin, (v) => _origin = v),
              const SizedBox(height: 12),
              _editableField('Destination', _destination, (v) => _destination = v),
            ])),

            // ── 6. Gross Weight + Freight ──
            _card(Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _label('Gross Weight (MT)'),
                const SizedBox(height: 6),
                DropdownButtonFormField<double>(
                  value: _grossWeight,
                  decoration: _inputDec(),
                  isExpanded: true,
                  items: [
                    for (var i = 1; i <= 30; i++) ...[
                      DropdownMenuItem(value: i.toDouble(), child: Text('$i MT')),
                      if (i < 30) DropdownMenuItem(value: i + 0.5, child: Text('${i}.5 MT')),
                    ]
                  ],
                  onChanged: (v) => setState(() => _grossWeight = v!),
                ),
              ])),
              const SizedBox(width: 12),
              Expanded(child: _textField(_freightCtrl, 'Freight (PKR)', 'e.g. 145320', keyboard: TextInputType.number)),
            ])),

            // ── 7. POD Required + Transit Loss ──
            _card(Column(children: [
              _dropdown('POD Required', _podRequired, {'yes': 'Yes', 'no': 'No', 'scan': 'Scan'}, (v) => setState(() => _podRequired = v!)),
              const SizedBox(height: 12),
              _dropdown('Transit Loss', _transitLoss, {'customer': 'At Customer End', 'transporter': 'At Transporter End'}, (v) => setState(() => _transitLoss = v!)),
              const SizedBox(height: 12),
              _textField(_creditTermCtrl, 'Credit Term (Days)', 'e.g. 30', keyboard: TextInputType.number),
            ])),

            // ── 8. Bilty Document ──
            _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _label('Bilty Document'),
              const SizedBox(height: 8),
              if (_fileBase64 != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.blue.shade200)),
                  child: Row(children: [
                    Icon(_fileType == 'pdf' ? Icons.picture_as_pdf : Icons.image, color: Colors.blue.shade700, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_fileName ?? 'File selected', style: TextStyle(fontSize: 12, color: Colors.blue.shade800), overflow: TextOverflow.ellipsis)),
                    Icon(Icons.check_circle, color: Colors.green.shade600, size: 20),
                  ]),
                )
              else if (_existing?['bilty_file_base64'] != null || _existing?['image_base64'] != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.green.shade200)),
                  child: Row(children: [
                    Icon(Icons.check_circle, color: Colors.green.shade700, size: 20),
                    const SizedBox(width: 8),
                    Text('Document already uploaded', style: TextStyle(fontSize: 12, color: Colors.green.shade800, fontWeight: FontWeight.w500)),
                  ]),
                ),
              Row(children: [
                Expanded(child: _uploadBtn(Icons.camera_alt, 'Camera', Colors.blue.shade700, _pickCamera)),
                const SizedBox(width: 8),
                Expanded(child: _uploadBtn(Icons.photo_library, 'Gallery', Colors.purple.shade700, _pickGallery)),
                const SizedBox(width: 8),
                Expanded(child: _uploadBtn(Icons.picture_as_pdf, 'PDF', Colors.red.shade700, _pickPDF)),
              ]),
            ])),

            const SizedBox(height: 8),
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
                    : Text(_existing != null ? 'Update Bilty' : 'Submit & Notify Admin',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 20),
          ]),
        ),
      ),
    );
  }

  Widget _card(Widget child) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
    child: child,
  );

  Widget _label(String text) => Text(text, style: const TextStyle(fontSize: 12, color: Colors.black54, fontWeight: FontWeight.w500));

  InputDecoration _inputDec({String? hint}) => InputDecoration(
    hintText: hint, filled: true, fillColor: Colors.grey.shade50,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
  );

  Widget _textField(TextEditingController ctrl, String label, String hint, {TextInputType? keyboard}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [_label(label), const SizedBox(height: 6),
      TextField(controller: ctrl, keyboardType: keyboard, decoration: _inputDec(hint: hint))],
  );

  Widget _editableField(String label, String value, Function(String) onChanged) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [_label(label), const SizedBox(height: 6),
      TextFormField(initialValue: value, onChanged: onChanged, decoration: _inputDec(hint: label))],
  );

  Widget _readOnlyField(String label, String value, Color color) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [_label(label), const SizedBox(height: 6),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey.shade300)),
        child: Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
      )],
  );

  Widget _dropdown(String label, String value, Map<String, String> options, ValueChanged<String?> onChanged) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [_label(label), const SizedBox(height: 6),
      DropdownButtonFormField<String>(
        value: value, decoration: _inputDec(), isExpanded: true,
        items: options.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
        onChanged: onChanged,
      )],
  );

  Widget _uploadBtn(IconData icon, String label, Color color, VoidCallback onTap) => OutlinedButton.icon(
    onPressed: onTap,
    icon: Icon(icon, size: 15),
    label: Text(label, style: const TextStyle(fontSize: 11)),
    style: OutlinedButton.styleFrom(
      foregroundColor: color, side: BorderSide(color: color.withOpacity(0.4)),
      padding: const EdgeInsets.symmetric(vertical: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
  );
}
