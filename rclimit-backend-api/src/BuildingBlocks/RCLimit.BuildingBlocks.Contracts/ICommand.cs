using MediatR;

namespace RCLimit.BuildingBlocks.Contracts;

public interface ICommand : IRequest;

public interface ICommand<out TResponse> : IRequest<TResponse>;
