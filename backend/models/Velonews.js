<<<<<<< HEAD
// VERSION: v3.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
=======
// VERSION: v3.1.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
>>>>>>> bdce0b48cb5cbb7b2cf78af9d0929933c5816780
const { getDatabase } = require('../config/database');

class Velonews {
  constructor() {
<<<<<<< HEAD
    this.collectionName = 'velonews';
=======
    this.collectionName = 'Velonews';
>>>>>>> bdce0b48cb5cbb7b2cf78af9d0929933c5816780
  }

  // Obter coleção
  getCollection() {
    const db = getDatabase();
    return db.collection(this.collectionName);
  }

  // Criar nova velonews
  async create(velonewsData) {
    try {
      const collection = this.getCollection();
      const velonews = {
        ...velonewsData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.insertOne(velonews);
      return {
        success: true,
        data: { ...velonews, _id: result.insertedId },
        message: 'Velonews publicada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Listar todas as velonews
  async getAll() {
    try {
      const collection = this.getCollection();
      const velonews = await collection.find({}).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: velonews,
        count: velonews.length
      };
    } catch (error) {
      console.error('Erro ao listar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter velonews por ID
  async getById(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      const velonews = await collection.findOne({ _id: new ObjectId(id) });
      
      if (!velonews) {
        return {
          success: false,
          error: 'Velonews não encontrada'
        };
      }

      return {
        success: true,
        data: velonews
      };
    } catch (error) {
      console.error('Erro ao obter velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Atualizar velonews
  async update(id, updateData) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const updateDoc = {
        ...updateData,
        updatedAt: new Date()
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Velonews não encontrada'
        };
      }

      return {
        success: true,
        message: 'Velonews atualizada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Deletar velonews
  async delete(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const result = await collection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return {
          success: false,
          error: 'Velonews não encontrada'
        };
      }

      return {
        success: true,
        message: 'Velonews deletada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Contar velonews
  async count() {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments();
      
      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Erro ao contar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter velonews críticas
  async getCritical() {
    try {
      const collection = this.getCollection();
      const criticalVelonews = await collection.find({ isCritical: true }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: criticalVelonews,
        count: criticalVelonews.length
      };
    } catch (error) {
      console.error('Erro ao obter velonews críticas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new Velonews();
