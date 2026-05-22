class User {
  final String id;
  final String name;
  final String phone;
  final String role;
  final String status;

  User({required this.id, required this.name, required this.phone, required this.role, required this.status});

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'],
        name: j['name'],
        phone: j['phone'],
        role: j['role'],
        status: j['status'],
      );
}
