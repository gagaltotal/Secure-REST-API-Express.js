class IndexController {
  static async index(req, res) {
    res.json({ message: "Welcome to the API Lur!" });
  }
}

module.exports = IndexController;