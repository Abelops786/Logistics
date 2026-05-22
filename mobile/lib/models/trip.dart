class Trip {
  final String id;
  final String pickupLocation;
  final List<String> dropoffLocations;
  final String containerType;
  final double? systemEstimatedPrice;
  final double? agentRequestedPrice;
  final double? adminFinalPrice;
  final String status;
  final String createdAt;
  final String? plateNumber;
  final String? driverName;

  Trip({
    required this.id,
    required this.pickupLocation,
    required this.dropoffLocations,
    required this.containerType,
    this.systemEstimatedPrice,
    this.agentRequestedPrice,
    this.adminFinalPrice,
    required this.status,
    required this.createdAt,
    this.plateNumber,
    this.driverName,
  });

  factory Trip.fromJson(Map<String, dynamic> j) {
    List<String> drops = [];
    final raw = j['dropoff_locations'];
    if (raw is List) {
      drops = raw.map((e) => e.toString()).toList();
    } else if (raw is String) {
      drops = List<String>.from(raw.replaceAll('[', '').replaceAll(']', '').replaceAll('"', '').split(',').map((s) => s.trim()));
    }
    return Trip(
      id: j['id'],
      pickupLocation: j['pickup_location'],
      dropoffLocations: drops,
      containerType: j['container_type'],
      systemEstimatedPrice: j['system_estimated_price'] != null ? double.tryParse(j['system_estimated_price'].toString()) : null,
      agentRequestedPrice: j['agent_requested_price'] != null ? double.tryParse(j['agent_requested_price'].toString()) : null,
      adminFinalPrice: j['admin_final_price'] != null ? double.tryParse(j['admin_final_price'].toString()) : null,
      status: j['status'],
      createdAt: j['created_at'],
      plateNumber: j['plate_number'],
      driverName: j['driver_name'],
    );
  }

  String get route => '$pickupLocation → ${dropoffLocations.join(' → ')}';
}
