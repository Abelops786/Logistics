import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../providers/app_provider.dart';
import '../widgets/location_picker.dart';

class BookingScreen extends StatefulWidget {
  const BookingScreen({super.key});
  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  String _pickupLocation = '';
  final List<String> _dropoffLocations = [''];
  String _containerType = '50ft_22_wheeler';
  bool _isDouble = false;
  bool _counterOffer = false;
  final _counterPriceCtrl = TextEditingController();
  final _clientNameCtrl = TextEditingController();
  final _clientPhoneCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _cargoCtrl = TextEditingController();
  bool _submitting = false;
  int _formKey = 0;

  final _containerLabels = {
    '50ft_22_wheeler': '50ft 14-Wheeler Container',
    '47ft_22_wheeler_jumbo': '47ft 14-Wheeler Jumbo Container',
  };

  Future<void> _submitRequest() async {
    final pickup = _pickupLocation.trim();
    final drops = _dropoffLocations.where((s) => s.isNotEmpty).toList();

    if (pickup.isEmpty || drops.isEmpty) {
      _showErr('Please fill pickup and at least one dropoff location.');
      return;
    }

    setState(() => _submitting = true);
    try {
      final body = {
        'pickup_location': pickup,
        'dropoff_locations': drops,
        'container_type': _containerType,
        'is_double': _isDouble,
        if (_clientNameCtrl.text.isNotEmpty) 'client_name': _clientNameCtrl.text.trim(),
        if (_clientPhoneCtrl.text.isNotEmpty) 'client_phone': _clientPhoneCtrl.text.trim(),
        if (_weightCtrl.text.isNotEmpty) 'weight_ton': double.tryParse(_weightCtrl.text),
        if (_cargoCtrl.text.isNotEmpty) 'cargo_items': _cargoCtrl.text.trim(),
        if (_counterOffer && _counterPriceCtrl.text.isNotEmpty)
          'agent_requested_price': int.tryParse(_counterPriceCtrl.text),
      };

      final res = await ApiService.post('/api/trips/request', body);
      if (res != null && res['trip'] != null) {
        await context.read<AppProvider>().loadLedger();
        _showSuccess('Trip request submitted! Admin will review shortly.');
        _resetForm();
      } else {
        _showErr(res?['message'] ?? 'Submission failed. Please try again.');
      }
    } catch (e) {
      _showErr(e.toString());
    } finally {
      setState(() => _submitting = false);
    }
  }

  void _resetForm() {
    _dropoffLocations.clear();
    _dropoffLocations.add('');
    _counterPriceCtrl.clear();
    _clientNameCtrl.clear();
    _clientPhoneCtrl.clear();
    _weightCtrl.clear();
    _cargoCtrl.clear();
    setState(() {
      _pickupLocation = '';
      _counterOffer = false;
      _isDouble = false;
      _formKey++;
    });
  }

  void _showErr(String msg) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700));

  void _showSuccess(String msg) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(msg), backgroundColor: Colors.green.shade700));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        title: const Text('New Booking Request', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _section('Route Details', _buildRouteSection()),
            const SizedBox(height: 16),
            _section('Container Type', _buildVehicleSection()),
            const SizedBox(height: 16),
            _section('Client Details', _buildClientSection()),
            const SizedBox(height: 16),
            _section('Cargo Details', _buildCargoSection()),
            const SizedBox(height: 16),
            _section('Client Budget', _buildBudgetSection()),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submitRequest,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue.shade700,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _submitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Submit Request', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, Widget child) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        const SizedBox(height: 12),
        child,
      ]),
    );
  }

  Widget _buildRouteSection() {
    return Column(
      children: [
        LocationPickerField(
          key: ValueKey('pickup_$_formKey'),
          hint: 'Pickup Location',
          icon: Icons.radio_button_checked,
          iconColor: Colors.green,
          initialValue: _pickupLocation,
          onLocationSelected: (val) => setState(() => _pickupLocation = val),
        ),
        const SizedBox(height: 10),
        ...List.generate(_dropoffLocations.length, (i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            Expanded(
              child: LocationPickerField(
                key: ValueKey('dropoff_${i}_$_formKey'),
                hint: 'Dropoff ${i + 1}',
                icon: Icons.location_on,
                iconColor: Colors.red,
                initialValue: _dropoffLocations[i],
                onLocationSelected: (val) => setState(() => _dropoffLocations[i] = val),
              ),
            ),
            if (_dropoffLocations.length > 1) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => setState(() => _dropoffLocations.removeAt(i)),
                child: const Icon(Icons.remove_circle, color: Colors.red, size: 22),
              ),
            ],
          ]),
        )),
        TextButton.icon(
          onPressed: () => setState(() => _dropoffLocations.add('')),
          icon: const Icon(Icons.add, size: 18),
          label: const Text('Add Another Stopover'),
          style: TextButton.styleFrom(foregroundColor: Colors.blue.shade700),
        ),
      ],
    );
  }

  Widget _buildVehicleSection() {
    return Column(
      children: _containerLabels.entries.map((entry) {
        final selected = _containerType == entry.key;
        return GestureDetector(
          onTap: () => setState(() => _containerType = entry.key),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: selected ? Colors.blue.shade50 : Colors.grey.shade50,
              border: Border.all(color: selected ? Colors.blue.shade700 : Colors.grey.shade300, width: selected ? 2 : 1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(children: [
              Icon(Icons.local_shipping, color: selected ? Colors.blue.shade700 : Colors.grey, size: 28),
              const SizedBox(width: 12),
              Expanded(child: Text(entry.value, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? Colors.blue.shade700 : Colors.black87))),
              if (selected) Icon(Icons.check_circle, color: Colors.blue.shade700),
            ]),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildClientSection() {
    return Column(
      children: [
        TextField(
          controller: _clientNameCtrl,
          decoration: InputDecoration(
            labelText: 'Client Name',
            hintText: 'e.g. Ali Hassan',
            filled: true,
            fillColor: Colors.grey.shade50,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _clientPhoneCtrl,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: 'Client Contact No',
            hintText: '03xxxxxxxxx',
            filled: true,
            fillColor: Colors.grey.shade50,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
          ),
        ),
      ],
    );
  }

  Widget _buildCargoSection() {
    return Column(
      children: [
        TextField(
          controller: _weightCtrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: 'Weight (Tons)',
            hintText: 'e.g. 20.5',
            suffixText: 'T',
            filled: true,
            fillColor: Colors.grey.shade50,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _cargoCtrl,
          decoration: InputDecoration(
            labelText: 'Items / Cargo Description',
            hintText: 'e.g. Cotton bales, Electronics',
            filled: true,
            fillColor: Colors.grey.shade50,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
          ),
        ),
        const SizedBox(height: 10),
        CheckboxListTile(
          value: _isDouble,
          onChanged: (v) => setState(() => _isDouble = v ?? false),
          title: const Text('Double Trip', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          subtitle: const Text('Two containers / two loads on this trip', style: TextStyle(fontSize: 12)),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
      ],
    );
  }

  Widget _buildBudgetSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CheckboxListTile(
          value: _counterOffer,
          onChanged: (v) => setState(() => _counterOffer = v ?? false),
          title: const Text('Client has a specific budget?', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
        if (_counterOffer) ...[
          const SizedBox(height: 8),
          TextField(
            controller: _counterPriceCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Client Offered Price (PKR)',
              prefixText: 'Rs. ',
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
            ),
          ),
        ],
        if (!_counterOffer)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Leave unchecked if client accepts admin pricing.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
            ),
          ),
      ],
    );
  }
}
