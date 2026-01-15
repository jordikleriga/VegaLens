import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';

const router = Router();

// In-memory storage (replace with database in production)
const dashboards = new Map();

// List all dashboards
router.get('/', (req, res) => {
  const list = Array.from(dashboards.values()).map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    visualizationCount: d.visualizations?.length || 0
  }));
  
  logger.info('Listing dashboards', { count: list.length });
  res.json(list);
});

// Get single dashboard
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Fetching dashboard', { id });
    const dashboard = dashboards.get(id);
    
    if (!dashboard) {
      logger.warn('Dashboard not found', { id });
      throw new AppError('Dashboard not found', 404);
    }
    
    logger.info('Dashboard fetched', { id, name: dashboard.name, vizCount: dashboard.visualizations?.length || 0 });
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// Create dashboard
router.post('/', (req, res, next) => {
  try {
    const { name, description, visualizations = [] } = req.body;
    
    if (!name) {
      throw new AppError('Dashboard name is required', 400);
    }
    
    const dashboard = {
      id: uuidv4(),
      name,
      description: description || '',
      visualizations,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    dashboards.set(dashboard.id, dashboard);
    logger.info('Dashboard created', { id: dashboard.id, name: dashboard.name });
    res.status(201).json(dashboard);
  } catch (error) {
    logger.error('Failed to create dashboard', { error: error.message, name: req.body?.name });
    next(error);
  }
});

// Update dashboard
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Updating dashboard', { id });
    const existing = dashboards.get(id);
    
    if (!existing) {
      logger.warn('Dashboard not found for update', { id });
      throw new AppError('Dashboard not found', 404);
    }
    
    const { name, description, visualizations } = req.body;
    
    const updated = {
      ...existing,
      name: name ?? existing.name,
      description: description ?? existing.description,
      visualizations: visualizations ?? existing.visualizations,
      updatedAt: new Date().toISOString()
    };
    
    dashboards.set(id, updated);
    logger.info('Dashboard updated', { id, name: updated.name, vizCount: updated.visualizations?.length || 0 });
    res.json(updated);
  } catch (error) {
    logger.error('Failed to update dashboard', { id: req.params.id, error: error.message });
    next(error);
  }
});

// Delete dashboard
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Deleting dashboard', { id });
    
    if (!dashboards.has(id)) {
      logger.warn('Dashboard not found for deletion', { id });
      throw new AppError('Dashboard not found', 404);
    }
    
    dashboards.delete(id);
    logger.info('Dashboard deleted', { id });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete dashboard', { id: req.params.id, error: error.message });
    next(error);
  }
});

// Add visualization to dashboard
router.post('/:id/visualizations', (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Adding visualization to dashboard', { dashboardId: id, vizType: req.body?.type });
    const dashboard = dashboards.get(id);
    
    if (!dashboard) {
      logger.warn('Dashboard not found for visualization add', { id });
      throw new AppError('Dashboard not found', 404);
    }
    
    const visualization = {
      id: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    dashboard.visualizations.push(visualization);
    dashboard.updatedAt = new Date().toISOString();
    
    logger.info('Visualization added to dashboard', { dashboardId: id, vizId: visualization.id, totalViz: dashboard.visualizations.length });
    res.status(201).json(visualization);
  } catch (error) {
    logger.error('Failed to add visualization', { dashboardId: req.params.id, error: error.message });
    next(error);
  }
});

// Update visualization in dashboard
router.put('/:dashboardId/visualizations/:vizId', (req, res, next) => {
  try {
    const { dashboardId, vizId } = req.params;
    logger.info('Updating visualization', { dashboardId, vizId });
    const dashboard = dashboards.get(dashboardId);
    
    if (!dashboard) {
      logger.warn('Dashboard not found for visualization update', { dashboardId });
      throw new AppError('Dashboard not found', 404);
    }
    
    const vizIndex = dashboard.visualizations.findIndex(v => v.id === vizId);
    
    if (vizIndex === -1) {
      logger.warn('Visualization not found for update', { dashboardId, vizId });
      throw new AppError('Visualization not found', 404);
    }
    
    dashboard.visualizations[vizIndex] = {
      ...dashboard.visualizations[vizIndex],
      ...req.body,
      id: vizId,
      updatedAt: new Date().toISOString()
    };
    
    dashboard.updatedAt = new Date().toISOString();
    
    logger.info('Visualization updated', { dashboardId, vizId });
    res.json(dashboard.visualizations[vizIndex]);
  } catch (error) {
    logger.error('Failed to update visualization', { dashboardId: req.params.dashboardId, vizId: req.params.vizId, error: error.message });
    next(error);
  }
});

// Remove visualization from dashboard
router.delete('/:dashboardId/visualizations/:vizId', (req, res, next) => {
  try {
    const { dashboardId, vizId } = req.params;
    logger.info('Removing visualization from dashboard', { dashboardId, vizId });
    const dashboard = dashboards.get(dashboardId);
    
    if (!dashboard) {
      logger.warn('Dashboard not found for visualization removal', { dashboardId });
      throw new AppError('Dashboard not found', 404);
    }
    
    const vizIndex = dashboard.visualizations.findIndex(v => v.id === vizId);
    
    if (vizIndex === -1) {
      logger.warn('Visualization not found for removal', { dashboardId, vizId });
      throw new AppError('Visualization not found', 404);
    }
    
    dashboard.visualizations.splice(vizIndex, 1);
    dashboard.updatedAt = new Date().toISOString();
    
    logger.info('Visualization removed', { dashboardId, vizId, remainingViz: dashboard.visualizations.length });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to remove visualization', { dashboardId: req.params.dashboardId, vizId: req.params.vizId, error: error.message });
    next(error);
  }
});

// Export dashboard to Kibana format
router.get('/:id/export/kibana', (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Exporting dashboard to Kibana format', { id });
    const dashboard = dashboards.get(id);
    
    if (!dashboard) {
      logger.warn('Dashboard not found for export', { id });
      throw new AppError('Dashboard not found', 404);
    }
    
    // Convert to Kibana-compatible format
    const kibanaExport = {
      objects: dashboard.visualizations.map(viz => ({
        type: 'visualization',
        id: viz.id,
        attributes: {
          title: viz.title || 'Untitled',
          visState: JSON.stringify({
            type: 'vega',
            params: {
              spec: JSON.stringify(viz.vegaSpec, null, 2)
            }
          }),
          uiStateJSON: '{}',
          description: viz.description || ''
        }
      }))
    };
    
    logger.info('Dashboard exported to Kibana format', { id, vizCount: kibanaExport.objects.length });
    res.json(kibanaExport);
  } catch (error) {
    logger.error('Failed to export dashboard', { id: req.params.id, error: error.message });
    next(error);
  }
});

export default router;

