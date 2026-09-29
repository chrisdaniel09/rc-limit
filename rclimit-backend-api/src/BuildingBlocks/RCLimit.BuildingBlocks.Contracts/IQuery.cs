using MediatR;

namespace RCLimit.BuildingBlocks.Contracts;

public interface IQuery<out TResponse> : IRequest<TResponse>;
