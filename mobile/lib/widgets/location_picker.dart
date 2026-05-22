import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';

// Replace with your Google Maps API key
const String _mapsApiKey = 'AIzaSyBO7G5z5PCC5B8HZapjLbHniqg17u-rRHk';

class LocationPickerField extends StatefulWidget {
  final String hint;
  final IconData icon;
  final Color iconColor;
  final ValueChanged<String> onLocationSelected;
  final String? initialValue;

  const LocationPickerField({
    super.key,
    required this.hint,
    required this.icon,
    required this.iconColor,
    required this.onLocationSelected,
    this.initialValue,
  });

  @override
  State<LocationPickerField> createState() => _LocationPickerFieldState();
}

class _LocationPickerFieldState extends State<LocationPickerField> {
  late TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialValue ?? '');
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _openSearch() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LocationSearchSheet(hint: widget.hint),
    );
    if (result != null && result.isNotEmpty) {
      _ctrl.text = result;
      widget.onLocationSelected(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _openSearch,
      child: AbsorbPointer(
        child: TextField(
          controller: _ctrl,
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
            prefixIcon: Icon(widget.icon, color: widget.iconColor, size: 18),
            filled: true,
            fillColor: Colors.grey.shade50,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ),
    );
  }
}

class _LocationSearchSheet extends StatefulWidget {
  final String hint;
  const _LocationSearchSheet({required this.hint});

  @override
  State<_LocationSearchSheet> createState() => _LocationSearchSheetState();
}

class _LocationSearchSheetState extends State<_LocationSearchSheet> {
  final _searchCtrl = TextEditingController();
  List<dynamic> _results = [];
  Timer? _debounce;
  bool _loading = false;

  void _search(String val) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      if (val.trim().isEmpty) {
        setState(() => _results = []);
        return;
      }
      setState(() => _loading = true);
      try {
        final url =
            'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${Uri.encodeComponent(val)}&key=$_mapsApiKey&components=country:pk';
        final res = await http.get(Uri.parse(url));
        final data = jsonDecode(res.body);
        if (data['status'] == 'OK' && mounted) {
          setState(() => _results = data['predictions']);
        }
      } catch (_) {}
      finally {
        if (mounted) setState(() => _loading = false);
      }
    });
  }

  void _select(String placeId, String description) async {
    // Just return the description text — enough for our text-based backend
    Navigator.pop(context, description);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(10)),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchCtrl,
              autofocus: true,
              onChanged: _search,
              decoration: InputDecoration(
                hintText: widget.hint,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _loading ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                ) : null,
                filled: true,
                fillColor: Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              itemCount: _results.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final r = _results[i];
                final main = r['structured_formatting']?['main_text'] ?? r['description'];
                final secondary = r['structured_formatting']?['secondary_text'] ?? '';
                return ListTile(
                  leading: const Icon(Icons.location_on_outlined, color: Colors.grey),
                  title: Text(main, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                  subtitle: secondary.isNotEmpty ? Text(secondary, style: const TextStyle(fontSize: 12)) : null,
                  onTap: () => _select(r['place_id'], r['description']),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
